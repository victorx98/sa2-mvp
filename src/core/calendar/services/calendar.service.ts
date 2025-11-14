import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
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
import { QuerySlotDto } from "../dto/query-slot.dto";
import {
  ICalendarSlotEntity,
  ITimeRange,
  UserType,
  SlotStatus,
  SlotType,
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
      // Validate input before INSERT
      this.validateSlotInput(dto);

      const startTime = new Date(dto.startTime);
      const endTime = new Date(startTime.getTime() + dto.durationMinutes * 60000);

      // Use transaction or provided executor
      const executor: DrizzleExecutor = tx ?? this.db;

      // Perform direct INSERT - let PostgreSQL EXCLUDE constraint handle conflicts
      const tstzrangeValue = `tstzrange('${startTime.toISOString()}'::timestamptz, '${endTime.toISOString()}'::timestamptz, '[)')`;
      
      const result = await executor.execute(sql`
        INSERT INTO calendar (
          user_id,
          user_type,
          time_range,
          duration_minutes,
          session_id,
          type,
          status,
          reason
        ) VALUES (
          ${dto.userId},
          ${dto.userType},
          ${sql.raw(tstzrangeValue)},
          ${dto.durationMinutes},
          ${dto.sessionId || null},
          ${dto.slotType},
          ${SlotStatus.BOOKED},
          ${dto.reason || null}
        )
        RETURNING *
      `);

      return this.mapToEntity(result.rows[0]);
    } catch (error) {
      // Extract the original pg error, compatible with Drizzle error wrapping
      const pgError =
        (error as { cause?: unknown })?.cause && typeof (error as { cause?: unknown }).cause === "object"
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

      const message = pgError?.message ?? (error instanceof Error ? error.message : "");

      // Return null for EXCLUDE constraint conflicts (SQLSTATE 23P01 or specific constraint name)
      if (
        pgError?.code === SQLSTATE_EXCLUDE_CONSTRAINT_VIOLATION ||
        (typeof message === "string" && message.includes(SQLSTATE_EXCLUDE_CONSTRAINT_VIOLATION)) ||
        pgError?.constraint === "calendar_no_overlap"
      ) {
        return null;
      }

      // other database errors should be thrown as CalendarException
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
   * Release a time slot (update status to cancelled)
   *
   * @param slotId - Slot ID
   * @returns Updated ICalendarSlotEntity
   * @throws CalendarNotFoundException if slot doesn't exist
   * @throws CalendarException if slot is already cancelled
   */
  async releaseSlot(slotId: string): Promise<ICalendarSlotEntity> {
    // Check if slot exists
    const existing = await this.getSlotById(slotId);
    if (!existing) {
      throw new CalendarNotFoundException(
        `Slot not found: ${slotId}`,
      );
    }

    // Check if already cancelled
    if (existing.status === SlotStatus.CANCELLED) {
      throw new CalendarException("Slot is already cancelled");
    }

    // Update status to cancelled
    const result = await this.db.execute(sql`
      UPDATE calendar
      SET status = ${SlotStatus.CANCELLED}, updated_at = NOW()
      WHERE id = ${slotId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new CalendarNotFoundException(
        `Failed to release slot: ${slotId}`,
      );
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
   * Reschedule a slot (release old slot and create new one)
   * Uses a database transaction to ensure atomicity
   *
   * @param oldSlotId - ID of the slot to reschedule
   * @param newStartTime - New start time
   * @param newDurationMinutes - New duration in minutes
   * @returns New ICalendarSlotEntity if successful
   * @throws CalendarNotFoundException if old slot doesn't exist
   * @throws CalendarException if new slot conflicts with existing bookings
   */
  async rescheduleSlot(
    oldSlotId: string,
    newStartTime: Date,
    newDurationMinutes: number,
  ): Promise<ICalendarSlotEntity | null> {
    // Get old slot
    const oldSlot = await this.getSlotById(oldSlotId);
    if (!oldSlot) {
      throw new CalendarNotFoundException(`Slot not found: ${oldSlotId}`);
    }

    // Use transaction to ensure atomicity: release old + create new
    return await this.db.transaction(async (tx) => {
      // Step 1: Release old slot
      await tx.execute(sql`
        UPDATE calendar
        SET status = ${SlotStatus.CANCELLED}, updated_at = NOW()
        WHERE id = ${oldSlotId}
      `);

      // Step 2: Create new slot (will be rejected by EXCLUDE constraint if conflict)
      const newEndTime = new Date(
        newStartTime.getTime() + newDurationMinutes * 60000,
      );

      try {
        const newTstzrangeValue = `tstzrange('${newStartTime.toISOString()}'::timestamptz, '${newEndTime.toISOString()}'::timestamptz, '[)')`;
        const result = await tx.execute(sql`
          INSERT INTO calendar (
            user_id,
            user_type,
            time_range,
            duration_minutes,
            session_id,
            type,
            status,
            reason
          ) VALUES (
            ${oldSlot.userId},
            ${oldSlot.userType},
            ${sql.raw(newTstzrangeValue)},
            ${newDurationMinutes},
            ${oldSlot.sessionId},
            ${oldSlot.slotType},
            ${SlotStatus.BOOKED},
            ${oldSlot.reason}
          )
          RETURNING *
        `);

        return this.mapToEntity(result.rows[0]);
      } catch (error) {
        // If new slot creation fails due to conflict, transaction will rollback
        if (error instanceof Error && error.message.includes("23P01")) {
          return null; // Return null if conflict during reschedule
        }
        throw error;
      }
    });
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
  async getSlotById(slotId: string): Promise<ICalendarSlotEntity | null> {
    const result = await this.db.execute(sql`
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
   * @returns Updated ICalendarSlotEntity
   * @throws CalendarNotFoundException if slot doesn't exist
   */
  async updateSlotSessionId(
    id: string,
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ICalendarSlotEntity> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const result = await executor.execute(sql`
      UPDATE calendar
      SET session_id = ${sessionId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new CalendarNotFoundException(`Slot not found: ${id}`);
    }

    return this.mapToEntity(result.rows[0]);
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
   * Map database row to entity interface
   * Converts PostgreSQL TSTZRANGE to ITimeRange
   *
   * @param row - Database row
   * @returns ICalendarSlotEntity
   */
  private mapToEntity(row: unknown): ICalendarSlotEntity {
    const record = row as {
      id: string;
      user_id: string;
      user_type: string; // NOTE: Column name changed from 'calendar_user_type' to 'user_type'
      time_range: string;
      duration_minutes: number;
      session_id: string | null;
      type: string; // NOTE: Database column is 'type' (not 'slot_type')
      status: string;
      reason: string | null;
      created_at: Date;
      updated_at: Date;
    };

    // Parse PostgreSQL tstzrange format: "[start, end)"
    // The custom type converts tstzrange to ITimeRange with start and end dates
    const timeRangeMatch = record.time_range.match(/\[(.*?), (.*?)\)/);
    let timeRange: ITimeRange;

    if (timeRangeMatch) {
      timeRange = {
        start: new Date(timeRangeMatch[1]),
        end: new Date(timeRangeMatch[2]),
      };
    } else {
      // Fallback if format is unexpected - calculate end time from duration
      const now = new Date();
      timeRange = {
        start: now,
        end: new Date(now.getTime() + record.duration_minutes * 60000),
      };
    }

    return {
      id: record.id,
      userId: record.user_id,
      userType: record.user_type as UserType, // NOTE: Column name is now 'user_type'
      timeRange,
      durationMinutes: record.duration_minutes,
      sessionId: record.session_id,
      slotType: record.type as SlotType, // NOTE: Column is 'type' (not 'slot_type')
      status: record.status as SlotStatus,
      reason: record.reason,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
