import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import {
  COMM_SESSION_CREATED_EVENT,
  COMM_SESSION_UPDATED_EVENT,
  SESSION_BOOKED_EVENT,
} from '@shared/events/event-constants';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { CommSessionService } from '@domains/services/comm-sessions/services/comm-session.service';
import { sql } from 'drizzle-orm';

/**
 * Communication Session Created Event Handler
 * 
 * Handles the asynchronous meeting creation flow for communication sessions
 * Communication sessions are typically between student and counselor/mentor for internal discussions
 * 
 * Design principles:
 * - Async event-driven architecture
 * - Not billable (no service registry updates)
 * - Loosely coupled to core services
 */
@Injectable()
export class CommSessionCreatedEventHandler {
  private readonly logger = new Logger(CommSessionCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly calendarService: CalendarService,
    private readonly commSessionService: CommSessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(COMM_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: any): Promise<void> {
    this.logger.log(`Handling COMM_SESSION_CREATED_EVENT: sessionId=${event.sessionId}`);

    try {
      // Step 1: Create meeting on third-party platform
      this.logger.debug(`Creating meeting for session ${event.sessionId}`);

      const meeting = await this.meetingManagerService.createMeeting({
        topic: event.topic,
        provider: event.meetingProvider as any,
        startTime: event.scheduledStartTime,
        duration: event.duration,
        hostUserId: this.getHostUserId(event.meetingProvider),
        autoRecord: false, // Communication sessions typically not recorded
        participantJoinEarly: true,
      });

      this.logger.debug(
        `Meeting created successfully: meetingId=${meeting.id}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 2: Update session and calendar slots in a transaction
      await this.db.transaction(async (tx) => {
        // 2.1: Update comm_sessions table with meeting_id and status
        await this.commSessionService.updateMeetingSetup(
          event.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Comm session meeting setup completed: sessionId=${event.sessionId}`);

        // 2.2: Update calendar slots with session_id, meeting_id, and meetingUrl
        await this.calendarService.updateSlotWithSessionAndMeeting(
          event.sessionId,
          meeting.id,
          meeting.meetingUrl,
          event.mentorCalendarSlotId || event.studentCalendarSlotId,
          event.studentCalendarSlotId,
          tx,
        );

        this.logger.debug(`Calendar slots updated for session ${event.sessionId}`);
      });

      // Step 3: Publish SESSION_BOOKED_EVENT
      this.eventEmitter.emit(SESSION_BOOKED_EVENT, {
        sessionId: event.sessionId,
        studentId: event.studentId,
        mentorId: event.mentorId,
        counselorId: event.counselorId,
        serviceType: 'comm_session',
        mentorCalendarSlotId: event.mentorCalendarSlotId,
        studentCalendarSlotId: event.studentCalendarSlotId,
        serviceHoldId: null,
        scheduledStartTime: event.scheduledStartTime,
        duration: event.duration,
        meetingProvider: event.meetingProvider,
        meetingPassword: null,
        meetingUrl: meeting.meetingUrl,
      });

      this.logger.log(`SESSION_BOOKED_EVENT published: sessionId=${event.sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to create meeting for session ${event.sessionId}: ${error.message}`, error.stack);
    }
  }

  @OnEvent(COMM_SESSION_UPDATED_EVENT)
  async handleSessionUpdated(event: any): Promise<void> {
    this.logger.log(
      `Handling COMM_SESSION_UPDATED_EVENT: sessionId=${event.sessionId}, ` +
      `timeChanged=${event.oldScheduledAt !== event.newScheduledAt}`,
    );

    try {
      // Step 1: Check if meeting is updatable
      const isMeetingUpdatable = await this.isMeetingUpdatable(event.meetingId);
      if (!isMeetingUpdatable) {
        this.logger.warn(
          `Meeting is in a non-updatable state. Update skipped. meetingId=${event.meetingId}`,
        );
        return;
      }

      // Step 2: Update external meeting platform with retry mechanism
      try {
        await this.retryWithBackoff(
          async () => {
            return await this.meetingManagerService.updateMeeting(
              event.meetingId,
              {
                topic: event.newTitle,
                startTime: event.newScheduledAt,
                duration: event.newDuration,
              },
            );
          },
          3, // Max retries
        );
      } catch (error) {
        this.logger.error(`Failed to update meeting ${event.meetingId}: ${error.message}`);
        // Continue to update DB even if external update fails
      }

      // Step 3: Update meetings table with new schedule info
      if (event.meetingId) {
        const startTime = new Date(event.newScheduledAt);
        await this.db.execute(sql`
          UPDATE meetings 
          SET 
            topic = ${event.newTitle},
            schedule_start_time = ${startTime.toISOString()},
            schedule_duration = ${event.newDuration},
            updated_at = NOW()
          WHERE id = ${event.meetingId}
        `);
        this.logger.debug(
          `Meetings table updated for comm session: meetingId=${event.meetingId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle COMM_SESSION_UPDATED_EVENT: ${error.message}`,
        error.stack,
      );
    }
  }

  private async isMeetingUpdatable(meetingId: string): Promise<boolean> {
    try {
      const result = await this.db.execute(
        sql`SELECT status FROM meetings WHERE id = ${meetingId}`,
      );
      const row = (result as any).rows?.[0];
      if (!row) {
        this.logger.warn(`Meeting not found: ${meetingId}`);
        return false;
      }
      // Only allow update for 'scheduled' or 'active' status
      return row.status === 'scheduled' || row.status === 'active';
    } catch (error) {
      this.logger.error(`Error checking meeting status: ${error.message}`);
      return false;
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    initialDelayMs: number = 1000,
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delayMs = initialDelayMs * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  private getHostUserId(provider: string): string | undefined {
    if (provider === 'feishu') {
      return FEISHU_DEFAULT_HOST_USER_ID;
    }
    return undefined;
  }
}

