import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import type {
  FeishuMeetingEvent,
  InsertFeishuMeetingEvent,
} from "@infrastructure/database/schema/feishu-meeting-events.schema";

/**
 * Feishu Meeting Event Repository
 * 
 * Handles CRUD operations for feishu_meeting_events table
 * Pure data access layer - no business logic
 * 
 * Note: This table is primarily for audit/archive purposes
 * Business logic should avoid querying this table
 */
@Injectable()
export class FeishuMeetingEventRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new Feishu meeting event
   * 
   * @param data - Event data
   * @param tx - Optional transaction
   * @returns Created event entity
   */
  async create(
    data: InsertFeishuMeetingEvent,
    tx?: DrizzleTransaction,
  ): Promise<FeishuMeetingEvent> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [event] = await executor
      .insert(schema.feishuMeetingEvents)
      .values(data)
      .returning();

    return event;
  }

  /**
   * Find event by event_id (for deduplication)
   * 
   * @param eventId - Unique event ID
   * @returns Event if found, null otherwise
   */
  async findByEventId(eventId: string): Promise<FeishuMeetingEvent | null> {
    const [event] = await this.db
      .select()
      .from(schema.feishuMeetingEvents)
      .where(eq(schema.feishuMeetingEvents.eventId, eventId))
      .limit(1);

    return event ?? null;
  }
}

