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
  ZoomMeetingEvent,
  InsertZoomMeetingEvent,
} from "@infrastructure/database/schema/zoom-meeting-events.schema";

/**
 * Zoom Meeting Event Repository
 * 
 * Handles CRUD operations for zoom_meeting_events table
 * Pure data access layer - no business logic
 * 
 * Note: This table is primarily for audit/archive purposes
 * Business logic should avoid querying this table
 */
@Injectable()
export class ZoomMeetingEventRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new Zoom meeting event
   * 
   * @param data - Event data
   * @param tx - Optional transaction
   * @returns Created event entity
   */
  async create(
    data: InsertZoomMeetingEvent,
    tx?: DrizzleTransaction,
  ): Promise<ZoomMeetingEvent> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [event] = await executor
      .insert(schema.zoomMeetingEvents)
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
  async findByEventId(eventId: string): Promise<ZoomMeetingEvent | null> {
    const [event] = await this.db
      .select()
      .from(schema.zoomMeetingEvents)
      .where(eq(schema.zoomMeetingEvents.eventId, eventId))
      .limit(1);

    return event ?? null;
  }
}

