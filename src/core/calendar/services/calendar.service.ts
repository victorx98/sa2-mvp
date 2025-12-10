import { Inject, Injectable } from "@nestjs/common";
import { sql, eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  CalendarException,
  CalendarNotFoundException,
} from "../exceptions/calendar.exception";
import { CreateSlotDto } from "../dto/create-slot.dto";
import { UpdateSlotDto } from "../dto/update-slot.dto";
import { QuerySlotDto } from "../dto/query-slot.dto";
import {
  ICalendarSlotEntity,
  ITimeRange,
  UserType,
  SlotStatus,
  SessionType,
  ICalendarMetadata,
} from "../interfaces/calendar-slot.interface";

/**
 * PostgreSQL Error Code for EXCLUDE constraint violation
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const SQLSTATE_EXCLUDE_CONSTRAINT_VIOLATION = "23P01";

@Injectable()
export class CalendarService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a time slot directly (atomic operation with EXCLUDE constraint protection)
   * This method performs a direct INSERT, and relies on PostgreSQL EXCLUDE constraint
   * to prevent overlapping bookings. It returns null if a constraint violation occurs.
   *
   * @param dto - CreateSlotDto containing user ID, type, start time, duration, etc.
   * @param tx - Optional transaction for atomicity
   * @returns ICalendarSlotEntity if successful, null if conflict (SQLSTATE 23P01)
   * @throws CalendarException for validation errors or unexpected database errors
   */
  async createSlotDirect(
    dto: CreateSlotDto,
    tx?: DrizzleTransaction,
  ): Promise<ICalendarSlotEntity | null> {
    try {
      this.validateSlotInput(dto);

      const startTime = new Date(dto.startTime);
      const endTime = new Date(startTime.getTime() + dto.durationMinutes * 60000);
      const executor: DrizzleExecutor = tx ?? this.db;

      const tstzrangeValue = `tstzrange('${startTime.toISOString()}'::timestamptz, '${endTime.toISOString()}'::timestamptz, '[)')`;
      const metadataValue = JSON.stringify(dto.metadata || {});
      
      const result = await executor.execute(sql`
        INSERT INTO calendar (
          user_id,
          user_type,
          time_range,
          duration_minutes,
          session_id,
          meeting_id,
          session_type,
          title,
          scheduled_start_time,
          status,
          metadata,
          reason
        ) VALUES (
          ${dto.userId},
          ${dto.userType},
          ${sql.raw(tstzrangeValue)},
          ${dto.durationMinutes},
          ${dto.sessionId || null},
          ${dto.meetingId || null},
          ${dto.sessionType},
          ${dto.title},
          ${startTime.toISOString()},
          ${SlotStatus.BOOKED},
          ${metadataValue}::jsonb,
          ${dto.reason || null}
        )
        RETURNING *
      `);

      return this.mapToEntity(result.rows[0]);
    } catch (error) {
      const pgError = this.extractPgError(error);
      const message = pgError?.message ?? (error instanceof Error ? error.message : "");

      if (
        pgError?.code === SQLSTATE_EXCLUDE_CONSTRAINT_VIOLATION ||
        (typeof message === "string" && message.includes(SQLSTATE_EXCLUDE_CONSTRAINT_VIOLATION)) ||
        pgError?.constraint === "calendar_no_overlap"
      ) {
        return null;
      }

      if (message) {
        throw new CalendarException(`Database error: ${message}`);
      }

      throw new CalendarException("Unknown database error occurred");
    }
  }

  /**
   * Check if a time slot is available for a user
   * This method is for UI feedback ONLY and should NOT be used to make write decisions.
   * Always use createSlotDirect() directly and let the database enforce constraints.
   *
   *
   * @param userId - User ID
   * @param userType - User type (optional, kept for compatibility)
   * @param startTime - Start time
   * @param durationMinutes - Duration in minutes
   * @returns true if no overlapping booked slots exist, false otherwise
   */
  async isSlotAvailable(
    userId: string,
    userType: UserType,
    startTime: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    // Validate input
    if (durationMinutes < 30 || durationMinutes > 180) {
      throw new CalendarException("Duration must be between 30 and 180 minutes");
    }

    if (startTime < new Date()) {
      throw new CalendarException("Start time cannot be in the past");
    }

    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // Query for overlapping booked slots (user_type not needed, only user_id + time_range)
    const tstzrangeValue = `tstzrange('${startTime.toISOString()}'::timestamptz, '${endTime.toISOString()}'::timestamptz, '[)')`;
    const result = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM calendar
      WHERE user_id = ${userId}
        AND status = ${SlotStatus.BOOKED}
        AND time_range && ${sql.raw(tstzrangeValue)}
    `);

    const count = parseInt((result.rows[0] as { count: string }).count);
    return count === 0;
  }

  /**
   * Universal update method for calendar slots (v5.3)
   * Supports partial updates - only provided fields will be updated
   * Automatically handles 23P01 conflict errors when updating time_range
   *
   * @param id - Slot ID
   * @param dto - UpdateSlotDto with fields to update
   * @param tx - Optional transaction for atomicity
   * @returns Updated ICalendarSlotEntity if successful, null if time conflict (SQLSTATE 23P01)
   * @throws CalendarNotFoundException if slot doesn't exist
   * @throws CalendarException for other database errors
   */
  async updateSlot(
    id: string,
    dto: UpdateSlotDto,
    tx?: DrizzleTransaction,
  ): Promise<ICalendarSlotEntity | null> {
    const existing = await this.getSlotById(id, tx); // 使用事务上下文查询
    if (!existing) {
      throw new CalendarNotFoundException(`Slot not found: ${id}`);
    }

    try {
      const executor: DrizzleExecutor = tx ?? this.db;
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (dto.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(dto.title);
      }

      if (dto.scheduledStartTime !== undefined && dto.durationMinutes !== undefined) {
        const startTime = dto.scheduledStartTime;
        const endTime = new Date(startTime.getTime() + dto.durationMinutes * 60000);
        const tstzrangeValue = `[${startTime.toISOString()}, ${endTime.toISOString()})`;
        
        updates.push(`time_range = $${paramIndex++}::tstzrange`);
        values.push(tstzrangeValue);
        
        updates.push(`scheduled_start_time = $${paramIndex++}`);
        values.push(startTime.toISOString());
        
        updates.push(`duration_minutes = $${paramIndex++}`);
        values.push(dto.durationMinutes);
      } else if (dto.scheduledStartTime !== undefined || dto.durationMinutes !== undefined) {
        throw new CalendarException(
          "Both scheduledStartTime and durationMinutes must be provided together"
        );
      }

      if (dto.metadata !== undefined) {
        const mergedMetadata = { ...existing.metadata, ...dto.metadata };
        updates.push(`metadata = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(mergedMetadata));
      }

      if (dto.sessionType !== undefined) {
        updates.push(`session_type = $${paramIndex++}`);
        values.push(dto.sessionType);
      }

      if (dto.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(dto.status);
      }

      if (updates.length === 0) {
        return existing;
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE calendar SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      
      const result = await executor.execute({
        sql: query,
        params: values,
      } as any);

      if (result.rows.length === 0) {
        throw new CalendarNotFoundException(`Failed to update slot: ${id}`);
      }

      return this.mapToEntity(result.rows[0]);
    } catch (error) {
      const pgError = this.extractPgError(error);

      if (
        pgError?.code === SQLSTATE_EXCLUDE_CONSTRAINT_VIOLATION ||
        pgError?.constraint === "exclude_calendar_time_overlap"
      ) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Cancel a time slot (update status to cancelled)
   *
   * @param slotId - Slot ID
   * @returns Updated ICalendarSlotEntity
   * @throws CalendarNotFoundException if slot doesn't exist
   * @throws CalendarException if slot is already cancelled
   */
  async cancelSlot(slotId: string): Promise<ICalendarSlotEntity> {
    const existing = await this.getSlotById(slotId);
    if (!existing) {
      throw new CalendarNotFoundException(`Slot not found: ${slotId}`);
    }

    if (existing.status === SlotStatus.CANCELLED) {
      throw new CalendarException("Slot is already cancelled");
    }

    const result = await this.db.execute(sql`
      UPDATE calendar
      SET status = ${SlotStatus.CANCELLED}, updated_at = NOW()
      WHERE id = ${slotId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new CalendarNotFoundException(`Failed to cancel slot: ${slotId}`);
    }

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Get booked slots for a user within a date range
   *
   * @param dto - QuerySlotDto with user ID, type, and optional date range
   * @returns Array of ICalendarSlotEntity
   * @throws CalendarException if date range exceeds 90 days
   */
  async getBookedSlots(dto: QuerySlotDto): Promise<ICalendarSlotEntity[]> {
    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : new Date();
    const dateTo = dto.dateTo
      ? new Date(dto.dateTo)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // Default 90 days

    // Validate date range
    const daysDiff = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      throw new CalendarException("Date range cannot exceed 90 days");
    }

    const dateTstzrangeValue = `tstzrange('${dateFrom.toISOString()}'::timestamptz, '${dateTo.toISOString()}'::timestamptz, '[)')`;
    const result = await this.db.execute(sql`
      SELECT *
      FROM calendar
      WHERE user_id = ${dto.userId}
        AND user_type = ${dto.userType}
        AND status = ${SlotStatus.BOOKED}
        AND time_range && ${sql.raw(dateTstzrangeValue)}
      ORDER BY time_range
    `);

    return result.rows.map((row) => this.mapToEntity(row));
  }


  /**
   * Get slot by session ID
   *
   * @param sessionId - Session ID
   * @returns ICalendarSlotEntity if found, null otherwise
   */
  async getSlotBySessionId(
    sessionId: string,
  ): Promise<ICalendarSlotEntity | null> {
    // NOTE: Table name is 'calendar' (not 'calendar_slots')
    const result = await this.db.execute(sql`
      SELECT *
      FROM calendar
      WHERE session_id = ${sessionId}
        AND status = ${SlotStatus.BOOKED}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Get slot by ID
   *
   * @param slotId - Slot ID
   * @returns ICalendarSlotEntity if found, null otherwise
   */
  async getSlotById(
    slotId: string,
    tx?: DrizzleTransaction,
  ): Promise<ICalendarSlotEntity | null> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const result = await executor.execute(sql`
      SELECT *
      FROM calendar
      WHERE id = ${slotId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Update slot with session ID
   * Used when slot is created without session ID and needs to be linked later
   *
   * @param id - Calendar slot ID
   * @param sessionId - Session ID to link
   * @param tx - Optional transaction for atomicity
   * @param meetingId - Optional meeting ID to link
   * @param metadataUpdate - Optional metadata fields to merge (e.g., meetingUrl)
   * @returns Updated ICalendarSlotEntity
   * @throws CalendarNotFoundException if slot doesn't exist
   */
  async updateSlotSessionId(
    id: string,
    sessionId: string,
    tx?: DrizzleTransaction,
    meetingId?: string,
    metadataUpdate?: Partial<ICalendarMetadata>,
  ): Promise<ICalendarSlotEntity> {
    const executor: DrizzleExecutor = tx ?? this.db;
    
    // If metadata needs to be updated, fetch existing slot first
    if (metadataUpdate) {
      const existing = await this.getSlotById(id, tx); // 使用事务上下文查询
      if (!existing) {
        throw new CalendarNotFoundException(`Slot not found: ${id}`);
      }
      
      const mergedMetadata = { ...existing.metadata, ...metadataUpdate };
      const metadataJson = JSON.stringify(mergedMetadata);
      
      const result = await executor.execute(sql`
        UPDATE calendar
        SET 
          session_id = ${sessionId}, 
          meeting_id = ${meetingId || null},
          metadata = ${metadataJson}::jsonb,
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        throw new CalendarNotFoundException(`Slot not found: ${id}`);
      }

      return this.mapToEntity(result.rows[0]);
    } else {
      // No metadata update, simple update
      const result = await executor.execute(sql`
        UPDATE calendar
        SET 
          session_id = ${sessionId}, 
          meeting_id = ${meetingId || null},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        throw new CalendarNotFoundException(`Slot not found: ${id}`);
      }

      return this.mapToEntity(result.rows[0]);
    }
  }

  /**
   * Update calendar slot status by meeting ID (v4.1)
   * Used by event listener when meeting lifecycle completes
   * Updates all calendar slots associated with the meeting
   *
   * @param meetingId - Meeting ID
   * @param status - New status
   * @param tx - Optional transaction for atomicity
   * @returns Number of updated slots
   */
  async updateStatusByMeetingId(
    meetingId: string,
    status: SlotStatus,
    tx?: DrizzleTransaction,
  ): Promise<number> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const result = await executor.execute(sql`
      UPDATE calendar
      SET 
        status = ${status},
        updated_at = NOW()
      WHERE meeting_id = ${meetingId}
      RETURNING *
    `);

    return result.rows.length;
  }

  /**
   * Validate slot input before database operations
   *
   * @param dto - CreateSlotDto to validate
   * @throws CalendarException if validation fails
   */
  private validateSlotInput(dto: CreateSlotDto): void {
    // Validate duration
    if (dto.durationMinutes < 30 || dto.durationMinutes > 180) {
      throw new CalendarException(
        "Duration must be between 30 and 180 minutes",
      );
    }

    // Validate start time
    const startTime = new Date(dto.startTime);
    if (startTime < new Date()) {
      throw new CalendarException("Start time cannot be in the past");
    }

    // Validate time range validity
    const endTime = new Date(startTime.getTime() + dto.durationMinutes * 60000);
    if (startTime >= endTime) {
      throw new CalendarException(
        "Invalid time range: end time must be after start time",
      );
    }
  }

  /**
   * Extract PostgreSQL error from Drizzle error wrapping
   *
   * @param error - Error object
   * @returns Extracted PostgreSQL error
   */
  private extractPgError(error: unknown) {
    return (error as { cause?: unknown })?.cause &&
      typeof (error as { cause?: unknown }).cause === "object"
      ? ((error as { cause?: unknown }).cause as {
          message?: string;
          code?: string;
          detail?: string;
          constraint?: string;
        })
      : (error as {
          message?: string;
          code?: string;
          detail?: string;
          constraint?: string;
        });
  }

  /**
   * Map database row to entity interface (v5.3)
   * Converts PostgreSQL TSTZRANGE to ITimeRange
   *
   * @param row - Database row
   * @returns ICalendarSlotEntity
   */
  private mapToEntity(row: unknown): ICalendarSlotEntity {
    const record = row as {
      id: string;
      user_id: string;
      user_type: string;
      time_range: string;
      duration_minutes: number;
      session_id: string | null;
      meeting_id: string | null;
      session_type: string;
      title: string;
      scheduled_start_time: Date;
      status: string;
      metadata: string | object;
      reason: string | null;
      created_at: Date;
      updated_at: Date;
    };

    const timeRangeMatch = record.time_range.match(/\[(.*?), (.*?)\)/);
    let timeRange: ITimeRange;

    if (timeRangeMatch) {
      timeRange = {
        start: new Date(timeRangeMatch[1]),
        end: new Date(timeRangeMatch[2]),
      };
    } else {
      const now = new Date();
      timeRange = {
        start: now,
        end: new Date(now.getTime() + record.duration_minutes * 60000),
      };
    }

    let metadata: ICalendarMetadata = {};
    if (record.metadata) {
      metadata =
        typeof record.metadata === "string"
          ? JSON.parse(record.metadata)
          : record.metadata;
    }

    return {
      id: record.id,
      userId: record.user_id,
      userType: record.user_type as UserType,
      timeRange,
      durationMinutes: record.duration_minutes,
      sessionId: record.session_id,
      meetingId: record.meeting_id,
      sessionType: record.session_type as SessionType,
      title: record.title,
      scheduledStartTime: new Date(record.scheduled_start_time),
      status: record.status as SlotStatus,
      metadata,
      reason: record.reason,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Update calendar slots with session ID, meeting ID, and meeting URL
   * Used during async meeting creation flow to link session and meeting info to calendar slots
   *
   * @param sessionId - Session ID to link
   * @param meetingId - Meeting ID from MeetingManagerService.createMeeting()
   * @param meetingUrl - Meeting URL from the created meeting
   * @param mentorSlotId - Mentor's calendar slot ID
   * @param studentSlotId - Student's calendar slot ID
   * @param tx - Optional transaction for atomicity
   */
  async updateSlotWithSessionAndMeeting(
    sessionId: string,
    meetingId: string,
    meetingUrl: string,
    mentorSlotId: string,
    studentSlotId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    try {
      // Update mentor slot
      const mentorSlot = await this.getSlotById(mentorSlotId, tx);
      if (!mentorSlot) {
        throw new Error(`Mentor slot not found: ${mentorSlotId}`);
      }

      const mentorMetadata = { ...mentorSlot.metadata, meetingUrl };
      const mentorMetadataJson = JSON.stringify(mentorMetadata);

      await executor.execute(sql`
        UPDATE calendar
        SET 
          session_id = ${sessionId},
          meeting_id = ${meetingId},
          metadata = ${mentorMetadataJson}::jsonb,
          updated_at = NOW()
        WHERE id = ${mentorSlotId}
      `);

      // Update student slot
      const studentSlot = await this.getSlotById(studentSlotId, tx);
      if (!studentSlot) {
        throw new Error(`Student slot not found: ${studentSlotId}`);
      }

      const studentMetadata = { ...studentSlot.metadata, meetingUrl };
      const studentMetadataJson = JSON.stringify(studentMetadata);

      await executor.execute(sql`
        UPDATE calendar
        SET 
          session_id = ${sessionId},
          meeting_id = ${meetingId},
          metadata = ${studentMetadataJson}::jsonb,
          updated_at = NOW()
        WHERE id = ${studentSlotId}
      `);
    } catch (error) {
      throw new Error(
        `Failed to update slots with session and meeting: ${error}`,
      );
    }
  }

  /**
   * Generic update method for calendar slots
   * Supports partial updates - only provided fields will be updated
   *
   * @param sessionId - Session ID to identify slots
   * @param updates - Partial object with fields to update (title, status, etc.)
   * @param tx - Optional transaction for atomicity
   */
  async updateSlots(
    sessionId: string,
    updates: Partial<{
      title: string;
      status: SlotStatus;
      metadata: ICalendarMetadata;
    }>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // Build update data object (Drizzle ORM style)
    const updateData: any = {};

    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = JSON.stringify(updates.metadata);
    }

    // Ensure updated_at is always set
    updateData.updated_at = new Date();

    if (Object.keys(updateData).length === 0) {
      return;
    }

    // Use Drizzle ORM update syntax (works with transactions)
    await executor
      .update(schema.calendarSlots)
      .set(updateData)
      .where(eq(schema.calendarSlots.sessionId, sessionId));
  }
}
