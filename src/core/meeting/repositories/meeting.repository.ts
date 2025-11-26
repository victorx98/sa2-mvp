import { Inject, Injectable } from "@nestjs/common";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { meetings } from "@infrastructure/database/schema/meetings.schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import type {
  Meeting,
  NewMeeting,
} from "@infrastructure/database/schema/meetings.schema";

/**
 * Meeting Repository
 *
 * Handles CRUD operations for meetings table
 * No business logic - pure data access layer
 */
@Injectable()
export class MeetingRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new meeting
   *
   * @param data - Meeting data
   * @param tx - Optional transaction
   * @returns Created meeting entity
   */
  async create(data: NewMeeting, tx?: DrizzleTransaction): Promise<Meeting> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [meeting] = await executor
      .insert(meetings)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return meeting;
  }

  /**
   * Find meeting by ID
   *
   * @param id - Meeting UUID
   * @returns Meeting if found, null otherwise
   */
  async findById(id: string): Promise<Meeting | null> {
    const [meeting] = await this.db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);

    return meeting ?? null;
  }

  /**
   * Find meeting by meeting_no within time window (for Webhook reverse lookup)
   *
   * According to design doc, we must add time window constraint to handle meeting_no reuse
   * Query: WHERE meeting_no = ? AND created_at > (occurred_at - 7 DAYS) ORDER BY created_at DESC LIMIT 1
   *
   * @param meetingNo - Meeting number
   * @param occurredAt - Event occurred time
   * @param daysWindow - Days window for lookup (default 7)
   * @returns Most recent meeting matching criteria
   */
  async findByMeetingNoWithinWindow(
    meetingNo: string,
    occurredAt: Date,
    daysWindow: number = 7,
  ): Promise<Meeting | null> {
    const windowStart = new Date(occurredAt);
    windowStart.setDate(windowStart.getDate() - daysWindow);

    const [meeting] = await this.db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.meetingNo, meetingNo),
          gte(meetings.createdAt, windowStart),
        ),
      )
      .orderBy(desc(meetings.createdAt))
      .limit(1);

    return meeting ?? null;
  }

  /**
   * Check if meeting exists within time window (for deduplication)
   *
   * Query: WHERE meeting_no = ? AND schedule_start_time BETWEEN (time-7d) AND (time+7d)
   *
   * @param meetingNo - Meeting number
   * @param scheduleStartTime - Scheduled start time
   * @param provider - Meeting provider
   * @param daysWindow - Days window (default 7)
   * @returns True if duplicate exists
   */
  async existsWithinTimeWindow(
    meetingNo: string,
    scheduleStartTime: Date,
    provider: string,
    daysWindow: number = 7,
  ): Promise<boolean> {
    const windowStart = new Date(scheduleStartTime);
    windowStart.setDate(windowStart.getDate() - daysWindow);

    const windowEnd = new Date(scheduleStartTime);
    windowEnd.setDate(windowEnd.getDate() + daysWindow);

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(meetings)
      .where(
        and(
          eq(meetings.meetingNo, meetingNo),
          eq(meetings.meetingProvider, provider),
          gte(meetings.scheduleStartTime, windowStart),
          lte(meetings.scheduleStartTime, windowEnd),
        ),
      );

    return Number(result.count) > 0;
  }

  /**
   * Update meeting by ID
   *
   * @param id - Meeting UUID
   * @param data - Partial meeting data
   * @param tx - Optional transaction
   * @returns Updated meeting entity
   */
  async update(
    id: string,
    data: Partial<NewMeeting>,
    tx?: DrizzleTransaction,
  ): Promise<Meeting> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [updated] = await executor
      .update(meetings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete meeting by ID (soft delete via status update)
   *
   * @param id - Meeting UUID
   * @param tx - Optional transaction
   * @returns True if deleted
   */
  async delete(id: string, tx?: DrizzleTransaction): Promise<boolean> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const result = await executor
      .update(meetings)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id));

    return result.rowCount > 0;
  }

  /**
   * Find meetings by status
   *
   * @param status - Meeting status
   * @param limit - Maximum number of results
   * @returns Array of meetings
   */
  async findByStatus(status: string, limit: number = 100): Promise<Meeting[]> {
    return this.db
      .select()
      .from(meetings)
      .where(eq(meetings.status, status))
      .orderBy(desc(meetings.scheduleStartTime))
      .limit(limit);
  }
}

