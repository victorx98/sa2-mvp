import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, isNull } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import { IRecording } from "../interfaces/session.interface";
import { SessionNotFoundException } from "../exceptions/session.exception";

/**
 * Session Recording Manager
 *
 * Manages session recordings (supports multiple recordings per session)
 * Handles recording append, transcript URL updates, and recording queries
 */
@Injectable()
export class SessionRecordingManager {
  private readonly logger = new Logger(SessionRecordingManager.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Append new recording to session's recordings array
   *
   * @param sessionId - Session ID
   * @param data - Recording data
   * @returns Updated recordings array
   */
  async appendRecording(
    sessionId: string,
    data: Omit<IRecording, "sequence">,
    tx?: DrizzleTransaction,
  ): Promise<IRecording[]> {
    this.logger.debug(
      `Appending recording to session: ${sessionId}, recordingId: ${data.recordingId}`,
    );
    const executor: DrizzleExecutor = tx ?? this.db;

    // Get current session
    const [session] = await executor
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, sessionId),
          isNull(schema.sessions.deletedAt),
        ),
      )
      .limit(1);

    if (!session) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // Get current recordings
    const currentRecordings =
      (session.recordings as unknown as IRecording[]) || [];

    // Calculate next sequence number
    const nextSequence = currentRecordings.length + 1;

    // Create new recording with sequence
    const newRecording: IRecording = {
      ...data,
      sequence: nextSequence,
    };

    // Append to recordings array
    const updatedRecordings = [...currentRecordings, newRecording];

    // Update database
    await executor
      .update(schema.sessions)
      .set({
        recordings: updatedRecordings as never,
      })
      .where(eq(schema.sessions.id, sessionId));

    this.logger.log(
      `Recording appended to session: ${sessionId}, sequence: ${nextSequence}`,
    );

    return updatedRecordings;
  }

  /**
   * Update transcript URL for a specific recording
   *
   * @param sessionId - Session ID
   * @param recordingId - Recording ID
   * @param transcriptUrl - Transcript URL
   * @returns Updated recordings array
   */
  async updateRecordingTranscript(
    sessionId: string,
    recordingId: string,
    transcriptUrl: string,
    tx?: DrizzleTransaction,
  ): Promise<IRecording[]> {
    this.logger.debug(
      `Updating transcript URL for recording: ${recordingId} in session: ${sessionId}`,
    );
    const executor: DrizzleExecutor = tx ?? this.db;

    // Get current session
    const [session] = await executor
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, sessionId),
          isNull(schema.sessions.deletedAt),
        ),
      )
      .limit(1);

    if (!session) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // Get current recordings
    const currentRecordings =
      (session.recordings as unknown as IRecording[]) || [];

    // Find and update the recording
    const updatedRecordings = currentRecordings.map((recording) => {
      if (recording.recordingId === recordingId) {
        return {
          ...recording,
          transcriptUrl,
        };
      }
      return recording;
    });

    // Check if recording was found
    const recordingFound = updatedRecordings.some(
      (r) => r.recordingId === recordingId && r.transcriptUrl === transcriptUrl,
    );

    if (!recordingFound) {
      this.logger.warn(
        `Recording not found: ${recordingId} in session: ${sessionId}`,
      );
      return currentRecordings;
    }

    // Update database
    await executor
      .update(schema.sessions)
      .set({
        recordings: updatedRecordings as never,
      })
      .where(eq(schema.sessions.id, sessionId));

    this.logger.log(
      `Transcript URL updated for recording: ${recordingId} in session: ${sessionId}`,
    );

    return updatedRecordings;
  }

  /**
   * Check if all recordings have transcript URLs fetched
   *
   * @param sessionId - Session ID
   * @returns True if all recordings have transcript URLs, false otherwise
   */
  async isAllTranscriptsFetched(sessionId: string): Promise<boolean> {
    this.logger.debug(
      `Checking if all transcripts are fetched for session: ${sessionId}`,
    );

    const recordings = await this.getAllRecordings(sessionId);

    if (recordings.length === 0) {
      return false;
    }

    const allFetched = recordings.every(
      (recording) => recording.transcriptUrl !== null,
    );

    this.logger.debug(
      `All transcripts fetched for session ${sessionId}: ${allFetched}`,
    );

    return allFetched;
  }

  /**
   * Get all recordings for a session
   *
   * @param sessionId - Session ID
   * @returns Array of recordings
   */
  async getAllRecordings(sessionId: string): Promise<IRecording[]> {
    this.logger.debug(`Getting all recordings for session: ${sessionId}`);

    // Get session
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, sessionId),
          isNull(schema.sessions.deletedAt),
        ),
      )
      .limit(1);

    if (!session) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    const recordings = (session.recordings as unknown as IRecording[]) || [];

    this.logger.debug(
      `Found ${recordings.length} recordings for session: ${sessionId}`,
    );

    return recordings;
  }

  /**
   * Get recording by sequence number
   *
   * @param sessionId - Session ID
   * @param sequence - Recording sequence number
   * @returns Recording or null if not found
   */
  async getRecordingBySequence(
    sessionId: string,
    sequence: number,
  ): Promise<IRecording | null> {
    this.logger.debug(
      `Getting recording by sequence: ${sequence} for session: ${sessionId}`,
    );

    const recordings = await this.getAllRecordings(sessionId);

    const recording = recordings.find((r) => r.sequence === sequence) || null;

    if (recording) {
      this.logger.debug(
        `Found recording with sequence ${sequence} for session: ${sessionId}`,
      );
    } else {
      this.logger.debug(
        `No recording found with sequence ${sequence} for session: ${sessionId}`,
      );
    }

    return recording;
  }
}
