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
   * Find meeting by meeting_id and provider (recommended for event lookups)
   *
   * This is the preferred method for webhook event lookups because:
   * - meeting_id is unique and permanent (no reuse issue)
   * - No need for time window constraints
   * - Better performance with direct index lookup
   *
   * @param provider - Meeting provider ('feishu' | 'zoom')
   * @param meetingId - Meeting ID from provider (Feishu reserve.id, Zoom id)
   * @returns Meeting if found, null otherwise
   */
  async findByMeetingId(
    provider: string,
    meetingId: string,
  ): Promise<Meeting | null> {
    const [meeting] = await this.db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.meetingProvider, provider),
          eq(meetings.meetingId, meetingId),
        ),
      )
      .limit(1);

    return meeting ?? null;
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

