import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, isNull } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  MentoringSessionException,
  MentoringSessionNotFoundException,
  MentoringSessionValidationException,
  MentoringSessionStateException,
} from "../exceptions/mentoring.exception";
import { CreateMentoringDto } from "../dto/create-mentoring.dto";
import { UpdateMentoringDto } from "../dto/update-mentoring.dto";
import {
  MentoringSessionEntity,
  MentoringSessionStatus,
} from "../entities/mentoring-session.entity";
import { MeetingLifecycleCompletedEvent } from "@core/meeting/events/meeting-lifecycle.events";

@Injectable()
export class MentoringService {
  private readonly logger = new Logger(MentoringService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create mentoring session record
   * Called by Application Layer after Core Meeting is created
   *
   * @param dto - Create mentoring session DTO
   * @param tx - Optional transaction context
   * @returns Created mentoring session entity
   */
  async createSession(
    dto: CreateMentoringDto,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity> {
    // 1. Validate student and mentor are different
    if (dto.studentId === dto.mentorId) {
      throw new MentoringSessionValidationException(
        "Student and mentor cannot be the same user",
      );
    }

    // 2. Verify meeting exists in Core Layer
    const meeting = await this.getMeetingById(dto.meetingId, tx);
    if (!meeting) {
      throw new MentoringSessionValidationException(
        `Meeting with ID ${dto.meetingId} not found in Core Layer`,
      );
    }

    // 3. Check if mentoring session already exists for this meeting
    const existingSession = await this.findByMeetingId(dto.meetingId, tx);
    if (existingSession) {
      throw new MentoringSessionValidationException(
        `Mentoring session already exists for meeting ${dto.meetingId}`,
      );
    }

    // 4. Create mentoring session record
    const executor: DrizzleExecutor = tx ?? this.db;

    const [session] = await executor
      .insert(schema.mentoringSessions)
      .values({
        meetingId: dto.meetingId,
        studentId: dto.studentId,
        mentorId: dto.mentorId,
        topic: dto.topic || null,
        notes: dto.notes || null,
        status: MentoringSessionStatus.SCHEDULED,
      })
      .returning();

    this.logger.log(
      `Created mentoring session ${session.id} for meeting ${dto.meetingId}`,
    );

    return this.mapToEntity(session);
  }

  /**
   * Update mentoring session business fields
   * Does not update meeting-related fields (managed by Core Layer)
   *
   * @param sessionId - Mentoring session ID
   * @param dto - Update mentoring session DTO
   * @param tx - Optional transaction context
   * @returns Updated mentoring session entity
   */
  async updateSession(
    sessionId: string,
    dto: UpdateMentoringDto,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity> {
    // 1. Check if session exists and not deleted
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new MentoringSessionNotFoundException();
    }

    // 2. Validate state transitions
    if (dto.status && !this.isValidStatusTransition(existing.status, dto.status)) {
      throw new MentoringSessionStateException(
        `Invalid status transition from ${existing.status} to ${dto.status}`,
      );
    }

    // 3. Validate rating if provided
    if (dto.rating !== undefined && (dto.rating < 1 || dto.rating > 5)) {
      throw new MentoringSessionValidationException(
        "Rating must be between 1 and 5",
      );
    }

    // 4. Build update values
    const updateValues: Partial<typeof schema.mentoringSessions.$inferInsert> = {};
    if (dto.status !== undefined) updateValues.status = dto.status;
    if (dto.serviceDuration !== undefined) updateValues.serviceDuration = dto.serviceDuration;
    if (dto.feedback !== undefined) updateValues.feedback = dto.feedback;
    if (dto.rating !== undefined) updateValues.rating = dto.rating;
    if (dto.topic !== undefined) updateValues.topic = dto.topic;
    if (dto.notes !== undefined) updateValues.notes = dto.notes;

    // 5. Update session
    const executor: DrizzleExecutor = tx ?? this.db;

    const [updated] = await executor
      .update(schema.mentoringSessions)
      .set(updateValues)
      .where(eq(schema.mentoringSessions.id, sessionId))
      .returning();

    this.logger.log(`Updated mentoring session ${sessionId}`);

    return this.mapToEntity(updated);
  }

  /**
   * Soft delete mentoring session
   * Sets status to DELETED and records deleted_at timestamp
   *
   * @param sessionId - Mentoring session ID
   * @param tx - Optional transaction context
   * @returns Deleted mentoring session entity
   */
  async deleteSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity> {
    // 1. Check if session exists
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new MentoringSessionNotFoundException();
    }

    // 2. Soft delete
    const executor: DrizzleExecutor = tx ?? this.db;

    const [deleted] = await executor
      .update(schema.mentoringSessions)
      .set({
        status: MentoringSessionStatus.DELETED,
        deletedAt: new Date(),
      })
      .where(eq(schema.mentoringSessions.id, sessionId))
      .returning();

    this.logger.log(`Soft deleted mentoring session ${sessionId}`);

    return this.mapToEntity(deleted);
  }

  /**
   * Complete mentoring session
   * Event-driven method called when meeting lifecycle completes
   *
   * @param sessionId - Mentoring session ID
   * @param event - Meeting lifecycle completed event
   * @param tx - Optional transaction context
   */
  async completeSession(
    sessionId: string,
    event: MeetingLifecycleCompletedEvent,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity> {
    // 1. Check if session exists
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new MentoringSessionNotFoundException();
    }

    // 2. Check if session is in valid state for completion
    if (existing.status === MentoringSessionStatus.COMPLETED) {
      this.logger.warn(`Mentoring session ${sessionId} is already completed`);
      return existing;
    }

    if (existing.status === MentoringSessionStatus.CANCELLED) {
      throw new MentoringSessionStateException(
        "Cannot complete a cancelled session",
      );
    }

    // 3. Update session with completion data
    const executor: DrizzleExecutor = tx ?? this.db;

    const [completed] = await executor
      .update(schema.mentoringSessions)
      .set({
        status: MentoringSessionStatus.COMPLETED,
        serviceDuration: event.actualDuration, // Use physical duration from Core Layer
      })
      .where(eq(schema.mentoringSessions.id, sessionId))
      .returning();

    this.logger.log(
      `Completed mentoring session ${sessionId} with duration ${event.actualDuration}s`,
    );

    // TODO: Trigger billing/settlement logic here
    // TODO: Trigger feedback request notification

    return this.mapToEntity(completed);
  }

  /**
   * Cancel mentoring session
   * Updates status to CANCELLED and records cancellation reason in notes
   *
   * @param sessionId - Mentoring session ID
   * @param reason - Cancellation reason
   * @param tx - Optional transaction context
   * @returns Cancelled mentoring session entity
   */
  async cancelSession(
    sessionId: string,
    reason: string,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity> {
    // 1. Check if session exists
    const existing = await this.getSessionById(sessionId, tx);
    if (!existing) {
      throw new MentoringSessionNotFoundException();
    }

    // 2. Check if session can be cancelled
    if (existing.status === MentoringSessionStatus.COMPLETED) {
      throw new MentoringSessionStateException(
        "Cannot cancel a completed session",
      );
    }

    if (existing.status === MentoringSessionStatus.CANCELLED) {
      this.logger.warn(`Mentoring session ${sessionId} is already cancelled`);
      return existing;
    }

    // 3. Append cancellation reason to notes
    const updatedNotes = existing.notes
      ? `${existing.notes}\n\n[Cancelled] ${reason}`
      : `[Cancelled] ${reason}`;

    // 4. Update status to cancelled
    const executor: DrizzleExecutor = tx ?? this.db;

    const [cancelled] = await executor
      .update(schema.mentoringSessions)
      .set({
        status: MentoringSessionStatus.CANCELLED,
        notes: updatedNotes,
      })
      .where(eq(schema.mentoringSessions.id, sessionId))
      .returning();

    this.logger.log(`Cancelled mentoring session ${sessionId}: ${reason}`);

    // TODO: Optionally call Core Layer to cancel meeting
    // TODO: Trigger cancellation notification

    return this.mapToEntity(cancelled);
  }

  /**
   * Get mentoring session by ID (excludes soft deleted records)
   *
   * @param sessionId - Mentoring session ID
   * @param tx - Optional transaction context
   * @returns Mentoring session entity or null
   */
  async getSessionById(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [session] = await executor
      .select()
      .from(schema.mentoringSessions)
      .where(
        and(
          eq(schema.mentoringSessions.id, sessionId),
          isNull(schema.mentoringSessions.deletedAt),
        ),
      )
      .limit(1);

    return session ? this.mapToEntity(session) : null;
  }

  /**
   * Find mentoring session by meeting ID
   * Used by event listener to identify mentoring sessions
   *
   * @param meetingId - Meeting ID from Core Layer
   * @param tx - Optional transaction context
   * @returns Mentoring session entity or null
   */
  async findByMeetingId(
    meetingId: string,
    tx?: DrizzleTransaction,
  ): Promise<MentoringSessionEntity | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [session] = await executor
      .select()
      .from(schema.mentoringSessions)
      .where(
        and(
          eq(schema.mentoringSessions.meetingId, meetingId),
          isNull(schema.mentoringSessions.deletedAt),
        ),
      )
      .limit(1);

    return session ? this.mapToEntity(session) : null;
  }

  /**
   * Get meeting by ID from Core Layer
   *
   * @param meetingId - Meeting ID
   * @param tx - Optional transaction context
   * @returns Meeting record or null
   */
  private async getMeetingById(
    meetingId: string,
    tx?: DrizzleTransaction,
  ): Promise<typeof schema.meetings.$inferSelect | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [meeting] = await executor
      .select()
      .from(schema.meetings)
      .where(eq(schema.meetings.id, meetingId))
      .limit(1);

    return meeting || null;
  }

  /**
   * Validate status transition
   *
   * @param currentStatus - Current session status
   * @param newStatus - New session status
   * @returns True if transition is valid
   */
  private isValidStatusTransition(
    currentStatus: MentoringSessionStatus,
    newStatus: MentoringSessionStatus,
  ): boolean {
    // Define valid state transitions
    const validTransitions: Record<MentoringSessionStatus, MentoringSessionStatus[]> = {
      [MentoringSessionStatus.SCHEDULED]: [
        MentoringSessionStatus.COMPLETED,
        MentoringSessionStatus.CANCELLED,
        MentoringSessionStatus.DELETED,
      ],
      [MentoringSessionStatus.COMPLETED]: [
        MentoringSessionStatus.DELETED,
      ],
      [MentoringSessionStatus.CANCELLED]: [
        MentoringSessionStatus.DELETED,
      ],
      [MentoringSessionStatus.DELETED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  /**
   * Map database record to entity interface
   *
   * @param record - Database record
   * @returns Mentoring session entity
   */
  private mapToEntity(
    record: typeof schema.mentoringSessions.$inferSelect,
  ): MentoringSessionEntity {
    return {
      id: record.id,
      meetingId: record.meetingId,
      studentId: record.studentId,
      mentorId: record.mentorId,
      status: record.status as MentoringSessionStatus,
      serviceDuration: record.serviceDuration,
      feedback: record.feedback,
      rating: record.rating,
      topic: record.topic,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
}

