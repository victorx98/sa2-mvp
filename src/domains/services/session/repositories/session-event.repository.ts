import { Inject, Injectable } from "@nestjs/common";
import { eq, and, desc, asc } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import { ISessionEventEntity } from "../interfaces/session-event.interface";

/**
 * Session Event Repository
 *
 * Handles CRUD operations for session_events table
 * Used for event sourcing and duration calculation
 */
@Injectable()
export class SessionEventRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new session event
   *
   * @param data - Event data
   * @returns Created event entity
   */
  async create(
    data: {
      sessionId: string;
      provider: string;
      eventType: string;
      eventData: unknown;
      occurredAt: Date;
    },
    tx?: DrizzleTransaction,
  ): Promise<ISessionEventEntity> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [event] = await executor
      .insert(schema.sessionEvents)
      .values({
        sessionId: data.sessionId,
        provider: data.provider,
        eventType: data.eventType,
        eventData: data.eventData as Record<string, unknown>,
        occurredAt: data.occurredAt,
      })
      .returning();

    return this.mapToEntity(event);
  }

  /**
   * Find all events for a session
   *
   * @param sessionId - Session ID
   * @param orderBy - Order by field ('asc' or 'desc' by occurredAt)
   * @returns Array of events
   */
  async findBySessionId(
    sessionId: string,
    orderBy: "asc" | "desc" = "asc",
  ): Promise<ISessionEventEntity[]> {
    const events = await this.db
      .select()
      .from(schema.sessionEvents)
      .where(eq(schema.sessionEvents.sessionId, sessionId))
      .orderBy(
        orderBy === "asc"
          ? asc(schema.sessionEvents.occurredAt)
          : desc(schema.sessionEvents.occurredAt),
      );

    return events.map((event) => this.mapToEntity(event));
  }

  /**
   * Find events by session ID and event type
   *
   * @param sessionId - Session ID
   * @param eventType - Event type
   * @returns Array of events
   */
  async findBySessionIdAndType(
    sessionId: string,
    eventType: string,
  ): Promise<ISessionEventEntity[]> {
    const events = await this.db
      .select()
      .from(schema.sessionEvents)
      .where(
        and(
          eq(schema.sessionEvents.sessionId, sessionId),
          eq(schema.sessionEvents.eventType, eventType),
        ),
      )
      .orderBy(asc(schema.sessionEvents.occurredAt));

    return events.map((event) => this.mapToEntity(event));
  }

  /**
   * Find join/leave events for duration calculation
   *
   * @param sessionId - Session ID
   * @returns Array of join/leave events
   */
  async findJoinLeaveEvents(sessionId: string): Promise<ISessionEventEntity[]> {
    const events = await this.db
      .select()
      .from(schema.sessionEvents)
      .where(eq(schema.sessionEvents.sessionId, sessionId))
      .orderBy(asc(schema.sessionEvents.occurredAt));

    // Filter for join/leave events
    return events
      .filter(
        (event) =>
          event.eventType === "vc.meeting.join_meeting_v1" ||
          event.eventType === "vc.meeting.leave_meeting_v1" ||
          event.eventType === "meeting.participant_joined" ||
          event.eventType === "meeting.participant_left",
      )
      .map((event) => this.mapToEntity(event));
  }

  /**
   * Get event by ID
   *
   * @param eventId - Event ID
   * @returns Event entity or null
   */
  async findById(eventId: string): Promise<ISessionEventEntity | null> {
    const [event] = await this.db
      .select()
      .from(schema.sessionEvents)
      .where(eq(schema.sessionEvents.id, eventId))
      .limit(1);

    return event ? this.mapToEntity(event) : null;
  }

  /**
   * Count events for a session
   *
   * @param sessionId - Session ID
   * @returns Event count
   */
  async countBySessionId(sessionId: string): Promise<number> {
    const events = await this.db
      .select()
      .from(schema.sessionEvents)
      .where(eq(schema.sessionEvents.sessionId, sessionId));

    return events.length;
  }

  /**
   * Delete all events for a session (for cleanup/testing)
   *
   * @param sessionId - Session ID
   */
  async deleteBySessionId(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    await executor
      .delete(schema.sessionEvents)
      .where(eq(schema.sessionEvents.sessionId, sessionId));
  }

  /**
   * Map database record to entity
   */
  private mapToEntity(
    record: typeof schema.sessionEvents.$inferSelect,
  ): ISessionEventEntity {
    return {
      id: record.id,
      sessionId: record.sessionId,
      provider: record.provider,
      eventType: record.eventType,
      eventData: (record.eventData as Record<string, unknown>) || {},
      occurredAt: record.occurredAt,
      createdAt: record.createdAt,
    };
  }
}
