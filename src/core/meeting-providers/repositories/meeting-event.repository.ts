import { Inject, Injectable } from "@nestjs/common";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import type {
  MeetingEvent,
  InsertMeetingEvent,
} from "@infrastructure/database/schema/meeting-events.schema";

/**
 * Meeting Event Repository
 *
 * Handles CRUD operations for meeting_events table
 * No business logic - pure data access layer
 */
@Injectable()
export class MeetingEventRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new meeting event
   *
   * @param data - Event data
   * @param tx - Optional transaction
   * @returns Created event entity
   */
  async create(
    data: InsertMeetingEvent,
    tx?: DrizzleTransaction,
  ): Promise<MeetingEvent> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [event] = await executor
      .insert(schema.meetingEvents)
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
  async findByEventId(eventId: string): Promise<MeetingEvent | null> {
    const [event] = await this.db
      .select()
      .from(schema.meetingEvents)
      .where(eq(schema.meetingEvents.eventId, eventId))
      .limit(1);

    return event ?? null;
  }

  /**
   * Find all events by meeting number
   *
   * @param meetingNo - Feishu meeting number
   * @returns Array of events
   */
  async findByMeetingNo(meetingNo: string): Promise<MeetingEvent[]> {
    return this.db
      .select()
      .from(schema.meetingEvents)
      .where(eq(schema.meetingEvents.meetingNo, meetingNo))
      .orderBy(desc(schema.meetingEvents.occurredAt));
  }

  /**
   * Find all events by meeting ID
   *
   * @param meetingId - Platform-specific meeting ID
   * @returns Array of events
   */
  async findByMeetingId(meetingId: string): Promise<MeetingEvent[]> {
    return this.db
      .select()
      .from(schema.meetingEvents)
      .where(eq(schema.meetingEvents.meetingId, meetingId))
      .orderBy(desc(schema.meetingEvents.occurredAt));
  }

  /**
   * Find join/leave events for duration calculation
   *
   * @param meetingNo - Feishu meeting number
   * @param eventTypes - Array of event types to filter
   * @returns Array of join/leave events
   */
  async findJoinLeaveEvents(
    meetingNo: string,
    eventTypes: string[],
  ): Promise<MeetingEvent[]> {
    return this.db
      .select()
      .from(schema.meetingEvents)
      .where(
        and(
          eq(schema.meetingEvents.meetingNo, meetingNo),
          inArray(schema.meetingEvents.eventType, eventTypes),
        ),
      )
      .orderBy(schema.meetingEvents.occurredAt);
  }
}


