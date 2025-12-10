import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import {
  CLASS_SESSION_CREATED_EVENT,
  SESSION_BOOKED_EVENT,
} from '@shared/events/event-constants';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { ClassSessionService } from '@domains/services/class-sessions/sessions/services/class-session.service';

/**
 * Class Session Created Event Handler
 * 
 * Handles the asynchronous meeting creation flow for class sessions
 * Class sessions are group sessions for multiple students in a class
 * 
 * Design principles:
 * - Async event-driven architecture
 * - Not billable per student (bulk management model)
 * - Single mentor/teacher leads multiple student participants
 */
@Injectable()
export class ClassSessionCreatedEventHandler {
  private readonly logger = new Logger(ClassSessionCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly calendarService: CalendarService,
    private readonly classSessionService: ClassSessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(CLASS_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: any): Promise<void> {
    this.logger.log(`Handling CLASS_SESSION_CREATED_EVENT: sessionId=${event.sessionId}`);

    try {
      // Step 1: Create meeting on third-party platform
      this.logger.debug(`Creating meeting for session ${event.sessionId}`);

      const meeting = await this.meetingManagerService.createMeeting({
        topic: event.topic,
        provider: event.meetingProvider as any,
        startTime: event.scheduledStartTime,
        duration: event.duration,
        hostUserId: this.getHostUserId(event.meetingProvider),
        autoRecord: true, // Class sessions typically recorded for student review
        participantJoinEarly: true,
      });

      this.logger.debug(
        `Meeting created successfully: meetingId=${meeting.id}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 2: Update session and calendar slot in a transaction
      await this.db.transaction(async (tx) => {
        // 2.1: Update class_sessions table with meeting_id and status
        await this.classSessionService.updateMeetingSetup(
          event.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Class session meeting setup completed: sessionId=${event.sessionId}`);

        // 2.2: Update mentor calendar slot (mentor slot is the primary slot)
        await this.calendarService.updateSlotWithSessionAndMeeting(
          event.sessionId,
          meeting.id,
          meeting.meetingUrl,
          event.mentorCalendarSlotId,
          event.mentorCalendarSlotId, // Both point to mentor slot for class sessions
          tx,
        );

        this.logger.debug(`Calendar slot updated for session ${event.sessionId}`);
      });

      // Step 3: Publish SESSION_BOOKED_EVENT
      this.eventEmitter.emit(SESSION_BOOKED_EVENT, {
        sessionId: event.sessionId,
        studentId: event.classId, // Use classId as studentId for compatibility
        mentorId: event.mentorId,
        counselorId: null,
        serviceType: 'class_session',
        mentorCalendarSlotId: event.mentorCalendarSlotId,
        studentCalendarSlotId: event.mentorCalendarSlotId,
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

  private getHostUserId(provider: string): string | undefined {
    if (provider === 'feishu') {
      return FEISHU_DEFAULT_HOST_USER_ID;
    }
    return undefined;
  }
}

