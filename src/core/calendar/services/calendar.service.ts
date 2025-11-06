import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import {
  CalendarException,
  CalendarNotFoundException,
  CalendarConflictException,
} from "../exceptions/calendar.exception";
import { CreateSlotDto } from "../dto/create-slot.dto";
import { QuerySlotDto } from "../dto/query-slot.dto";
import {
  ICalendarSlotEntity,
  ITimeRange,
  ResourceType,
  SlotStatus,
  SlotType,
} from "../interfaces/calendar-slot.interface";

@Injectable()
export class CalendarService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Check if a time slot is available for a resource
   */
  async isSlotAvailable(
    resourceType: ResourceType,
    resourceId: string,
    startTime: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    // Calculate end time
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // Validate time range
    if (startTime >= endTime) {
      throw new CalendarException("INVALID_TIME_RANGE");
    }

    // Check if start time is in the past
    if (startTime < new Date()) {
      throw new CalendarException("TIME_SLOT_IN_PAST");
    }

    // Query for overlapping occupied slots
    // Note: PostgreSQL TSTZRANGE overlap operator '&&' needs to be used in raw SQL
    const result = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM calendar_slots
      WHERE resource_type = ${resourceType}
        AND resource_id = ${resourceId}
        AND status = 'occupied'
        AND time_range && tstzrange(${startTime.toISOString()}, ${endTime.toISOString()}, '[)')
    `);

    const count = parseInt((result.rows[0] as { count: string }).count);
    return count === 0;
  }

  /**
   * Get occupancy details for a time slot (if occupied)
   */
  async getSlotOccupancy(
    resourceType: ResourceType,
    resourceId: string,
    startTime: Date,
    durationMinutes: number,
  ): Promise<ICalendarSlotEntity | null> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // Query for overlapping occupied slots
    const result = await this.db.execute(sql`
      SELECT *
      FROM calendar_slots
      WHERE resource_type = ${resourceType}
        AND resource_id = ${resourceId}
        AND status = 'occupied'
        AND time_range && tstzrange(${startTime.toISOString()}, ${endTime.toISOString()}, '[)')
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Create an occupied time slot
   */
  async createOccupiedSlot(dto: CreateSlotDto): Promise<ICalendarSlotEntity> {
    // Validate duration
    if (dto.durationMinutes < 30 || dto.durationMinutes > 180) {
      throw new CalendarException("INVALID_DURATION");
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + dto.durationMinutes * 60000);

    // Check if start time is in the past
    if (startTime < new Date()) {
      throw new CalendarException("TIME_SLOT_IN_PAST");
    }

    // Check for conflicts
    const isAvailable = await this.isSlotAvailable(
      dto.resourceType,
      dto.resourceId,
      startTime,
      dto.durationMinutes,
    );

    if (!isAvailable) {
      throw new CalendarConflictException("TIME_SLOT_CONFLICT");
    }

    // Create time range string for PostgreSQL
    const timeRangeStr = `[${startTime.toISOString()}, ${endTime.toISOString()})`;

    // Insert slot
    const result = await this.db.execute(sql`
      INSERT INTO calendar_slots (
        resource_type,
        resource_id,
        time_range,
        duration_minutes,
        session_id,
        slot_type,
        status,
        reason
      ) VALUES (
        ${dto.resourceType},
        ${dto.resourceId},
        ${timeRangeStr}::tstzrange,
        ${dto.durationMinutes},
        ${dto.sessionId || null},
        ${dto.slotType},
        'occupied',
        ${dto.reason || null}
      )
      RETURNING *
    `);

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Release a time slot (update status to cancelled)
   */
  async releaseSlot(slotId: string): Promise<ICalendarSlotEntity> {
    // Check if slot exists
    const existing = await this.getSlotById(slotId);
    if (!existing) {
      throw new CalendarNotFoundException("SLOT_NOT_FOUND");
    }

    // Check if already cancelled
    if (existing.status === SlotStatus.CANCELLED) {
      throw new CalendarException("SLOT_ALREADY_CANCELLED");
    }

    // Update status
    const result = await this.db.execute(sql`
      UPDATE calendar_slots
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${slotId}
      RETURNING *
    `);

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Get occupied slots for a resource within a date range
   */
  async getOccupiedSlots(dto: QuerySlotDto): Promise<ICalendarSlotEntity[]> {
    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : new Date();
    const dateTo = dto.dateTo
      ? new Date(dto.dateTo)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // Default 90 days

    // Validate date range
    const daysDiff =
      (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      throw new CalendarException("DATE_RANGE_TOO_LARGE");
    }

    const result = await this.db.execute(sql`
      SELECT *
      FROM calendar_slots
      WHERE resource_type = ${dto.resourceType}
        AND resource_id = ${dto.resourceId}
        AND status = 'occupied'
        AND time_range && tstzrange(${dateFrom.toISOString()}, ${dateTo.toISOString()}, '[)')
      ORDER BY time_range
    `);

    return result.rows.map((row) => this.mapToEntity(row));
  }

  /**
   * Block a time slot (mentor sets unavailable time)
   */
  async blockTimeSlot(
    resourceType: ResourceType,
    resourceId: string,
    startTime: Date,
    durationMinutes: number,
    reason: string,
  ): Promise<ICalendarSlotEntity> {
    return await this.createOccupiedSlot({
      resourceType,
      resourceId,
      startTime: startTime.toISOString(),
      durationMinutes,
      slotType: SlotType.BLOCKED,
      reason,
    });
  }

  /**
   * Reschedule a slot (release old + create new)
   */
  async rescheduleSlot(
    oldSlotId: string,
    newStartTime: Date,
    newDurationMinutes: number,
  ): Promise<ICalendarSlotEntity> {
    // Get old slot
    const oldSlot = await this.getSlotById(oldSlotId);
    if (!oldSlot) {
      throw new CalendarNotFoundException("SLOT_NOT_FOUND");
    }

    // Check if new slot is available
    const isAvailable = await this.isSlotAvailable(
      oldSlot.resourceType,
      oldSlot.resourceId,
      newStartTime,
      newDurationMinutes,
    );

    if (!isAvailable) {
      throw new CalendarConflictException("TIME_SLOT_CONFLICT");
    }

    // Use transaction to ensure atomicity
    return await this.db.transaction(async (tx) => {
      // Release old slot
      await tx.execute(sql`
        UPDATE calendar_slots
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${oldSlotId}
      `);

      // Create new slot
      const endTime = new Date(
        newStartTime.getTime() + newDurationMinutes * 60000,
      );
      const timeRangeStr = `[${newStartTime.toISOString()}, ${endTime.toISOString()})`;

      const result = await tx.execute(sql`
        INSERT INTO calendar_slots (
          resource_type,
          resource_id,
          time_range,
          duration_minutes,
          session_id,
          slot_type,
          status,
          reason
        ) VALUES (
          ${oldSlot.resourceType},
          ${oldSlot.resourceId},
          ${timeRangeStr}::tstzrange,
          ${newDurationMinutes},
          ${oldSlot.sessionId},
          ${oldSlot.slotType},
          'occupied',
          ${oldSlot.reason}
        )
        RETURNING *
      `);

      return this.mapToEntity(result.rows[0]);
    });
  }

  /**
   * Get slot by session ID
   */
  async getSlotBySessionId(
    sessionId: string,
  ): Promise<ICalendarSlotEntity | null> {
    const result = await this.db.execute(sql`
      SELECT *
      FROM calendar_slots
      WHERE session_id = ${sessionId}
        AND status = 'occupied'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Get slot by ID
   */
  async getSlotById(slotId: string): Promise<ICalendarSlotEntity | null> {
    const result = await this.db.execute(sql`
      SELECT *
      FROM calendar_slots
      WHERE id = ${slotId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  /**
   * Map database row to entity interface
   */
  private mapToEntity(row: unknown): ICalendarSlotEntity {
    const record = row as {
      id: string;
      resource_type: string;
      resource_id: string;
      time_range: string;
      duration_minutes: number;
      session_id: string | null;
      slot_type: string;
      status: string;
      reason: string | null;
      created_at: Date;
      updated_at: Date;
    };

    // Parse PostgreSQL tstzrange format: "[start, end)"
    const timeRangeMatch = record.time_range.match(/\[(.*?), (.*?)\)/);
    let timeRange: ITimeRange;

    if (timeRangeMatch) {
      timeRange = {
        start: new Date(timeRangeMatch[1]),
        end: new Date(timeRangeMatch[2]),
      };
    } else {
      // Fallback if format is unexpected
      const now = new Date();
      timeRange = {
        start: now,
        end: new Date(now.getTime() + record.duration_minutes * 60000),
      };
    }

    return {
      id: record.id,
      resourceType: record.resource_type as ResourceType,
      resourceId: record.resource_id,
      timeRange,
      durationMinutes: record.duration_minutes,
      sessionId: record.session_id,
      slotType: record.slot_type as SlotType,
      status: record.status as SlotStatus,
      reason: record.reason,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
