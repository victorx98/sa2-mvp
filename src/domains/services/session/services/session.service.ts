import { Inject, Injectable } from "@nestjs/common";
import { eq, and, isNull } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  SessionException,
  SessionNotFoundException,
} from "../exceptions/session.exception";
import { CreateSessionDto } from "../dto/create-session.dto";
import { UpdateSessionDto } from "../dto/update-session.dto";
import { MeetingInfoDto } from "../dto/meeting-info.dto";
import {
  ISessionEntity,
  SessionStatus,
  MeetingProvider,
  IRecording,
  IAISummary,
} from "../interfaces/session.interface";

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create session record with meeting information (atomic operation)
   * BFF layer should call MeetingProvider.createMeeting() first, then pass meeting info to this method
   */
  async createSession(
    dto: CreateSessionDto,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity> {
    // 1. Validate start time is in the future
    const startTime = new Date(dto.scheduledStartTime);
    if (startTime <= new Date()) {
      throw new SessionException("INVALID_START_TIME");
    }

    // 2. Validate duration
    if (dto.scheduledDuration < 30 || dto.scheduledDuration > 180) {
      throw new SessionException("INVALID_DURATION");
    }

    // 3. Validate student and mentor are different
    if (dto.studentId === dto.mentorId) {
      throw new SessionException("STUDENT_MENTOR_SAME");
    }

    // 4. Generate session name if not provided
    const sessionName =
      dto.sessionName || `Session with mentor ${dto.mentorId.substring(0, 8)}`;

    // 5. Get meeting provider from DTO or use default
    const meetingProvider =
      dto.meetingProvider ||
      (process.env.DEFAULT_MEETING_PROVIDER as MeetingProvider) ||
      MeetingProvider.FEISHU;

    // 6. Create session record with meeting information
    const executor: DrizzleExecutor = tx ?? this.db;

    const [session] = await executor
      .insert(schema.sessions)
      .values({
        studentId: dto.studentId,
        mentorId: dto.mentorId,
        contractId: dto.contractId || null,
        meetingProvider: meetingProvider,
        meetingNo: dto.meetingNo || null,
        meetingUrl: dto.meetingUrl || null,
        meetingPassword: dto.meetingPassword || null,
        scheduledStartTime: startTime,
        scheduledDuration: dto.scheduledDuration,
        sessionName: sessionName,
        notes: dto.notes || null,
        status: "scheduled",
      })
      .returning();

    return this.mapToEntity(session);
  }

  /**
   * Update session business fields (does not include meeting sync)
   */
  async updateSession(
    sessionId: string,
    dto: UpdateSessionDto,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity> {
    // 1. Check if session exists and not deleted
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // 2. Check if session can be updated (not completed or cancelled)
    if (
      existing.status === SessionStatus.COMPLETED ||
      existing.status === SessionStatus.CANCELLED
    ) {
      throw new SessionException("SESSION_CANNOT_UPDATE");
    }

    // 3. Validate start time if provided
    if (dto.scheduledStartTime) {
      const newStartTime = new Date(dto.scheduledStartTime);
      if (newStartTime <= new Date()) {
        throw new SessionException("INVALID_START_TIME");
      }
    }

    // 4. Validate duration if provided
    if (dto.scheduledDuration) {
      if (dto.scheduledDuration < 30 || dto.scheduledDuration > 180) {
        throw new SessionException("INVALID_DURATION");
      }
    }

    // 5. Build update values
    const updateValues: Partial<typeof schema.sessions.$inferInsert> = {};
    if (dto.scheduledStartTime) {
      updateValues.scheduledStartTime = new Date(dto.scheduledStartTime);
    }
    if (dto.scheduledDuration !== undefined) {
      updateValues.scheduledDuration = dto.scheduledDuration;
    }
    if (dto.sessionName !== undefined) {
      updateValues.sessionName = dto.sessionName;
    }
    if (dto.notes !== undefined) {
      updateValues.notes = dto.notes;
    }
    if (dto.contractId !== undefined) {
      updateValues.contractId = dto.contractId;
    }
    if (dto.status !== undefined) {
      updateValues.status = dto.status;
    }

    // 6. Update session
    const executor: DrizzleExecutor = tx ?? this.db;

    const [updated] = await executor
      .update(schema.sessions)
      .set(updateValues)
      .where(eq(schema.sessions.id, sessionId))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Update meeting information (meeting_id, meeting_url, etc.)
   */
  async updateMeetingInfo(
    sessionId: string,
    info: MeetingInfoDto,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity> {
    // 1. Check if session exists
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // 2. Update meeting info
    const executor: DrizzleExecutor = tx ?? this.db;

    const [updated] = await executor
      .update(schema.sessions)
      .set({
        meetingProvider: info.meetingProvider,
        meetingNo: info.meetingNo || null,
        meetingUrl: info.meetingUrl,
        meetingPassword: info.meetingPassword || null,
      })
      .where(eq(schema.sessions.id, sessionId))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Cancel session (update status to cancelled, record cancel reason)
   */
  async cancelSession(
    sessionId: string,
    cancelReason: string,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity> {
    // 1. Check if session exists
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // 2. Check if session can be cancelled
    if (existing.status === SessionStatus.COMPLETED) {
      throw new SessionException("SESSION_CANNOT_CANCEL");
    }
    if (existing.status === SessionStatus.CANCELLED) {
      throw new SessionException("SESSION_ALREADY_CANCELLED");
    }

    // 3. Validate cancel reason
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new SessionException("CANCEL_REASON_REQUIRED");
    }

    // 4. Append cancel reason to notes
    const updatedNotes = existing.notes
      ? `${existing.notes}\n\n[Cancelled] ${cancelReason}`
      : `[Cancelled] ${cancelReason}`;

    // 5. Update status to cancelled
    const executor: DrizzleExecutor = tx ?? this.db;

    const [updated] = await executor
      .update(schema.sessions)
      .set({
        status: SessionStatus.CANCELLED,
        notes: updatedNotes,
      })
      .where(eq(schema.sessions.id, sessionId))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Soft delete session (set deleted_at timestamp)
   */
  async softDeleteSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity> {
    // 1. Check if session exists
    const existing = await this.getSessionById(sessionId);
    if (!existing) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // 2. Soft delete
    const executor: DrizzleExecutor = tx ?? this.db;

    const [deleted] = await executor
      .update(schema.sessions)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(schema.sessions.id, sessionId))
      .returning();

    return this.mapToEntity(deleted);
  }

  /**
   * Get session by ID (excludes soft deleted records)
   */
  async getSessionById(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

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

    return session ? this.mapToEntity(session) : null;
  }

  /**
   * Get session by meeting_no (Feishu meeting number)
   * Used by event subscribers to identify their sessions
   */
  async getSessionByMeetingNo(
    meetingNo: string,
    tx?: DrizzleTransaction,
  ): Promise<ISessionEntity | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [session] = await executor
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.meetingNo, meetingNo),
          isNull(schema.sessions.deletedAt),
        ),
      )
      .limit(1);

    return session ? this.mapToEntity(session) : null;
  }

  /**
   * Map database record to entity interface
   */
  private mapToEntity(
    record: typeof schema.sessions.$inferSelect,
  ): ISessionEntity {
    return {
      id: record.id,
      studentId: record.studentId,
      mentorId: record.mentorId,
      contractId: record.contractId,
      meetingProvider: record.meetingProvider,
      meetingNo: record.meetingNo,
      meetingUrl: record.meetingUrl,
      meetingPassword: record.meetingPassword,
      scheduledStartTime: record.scheduledStartTime,
      scheduledDuration: record.scheduledDuration,
      actualStartTime: record.actualStartTime,
      actualEndTime: record.actualEndTime,
      recordings: (record.recordings as unknown as IRecording[]) || [],
      aiSummary: (record.aiSummary as unknown as IAISummary | null) || null,
      mentorTotalDurationSeconds: record.mentorTotalDurationSeconds,
      studentTotalDurationSeconds: record.studentTotalDurationSeconds,
      effectiveTutoringDurationSeconds: record.effectiveTutoringDurationSeconds,
      mentorJoinCount: record.mentorJoinCount,
      studentJoinCount: record.studentJoinCount,
      sessionName: record.sessionName,
      notes: record.notes,
      status: record.status as SessionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
}
