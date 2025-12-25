import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  HandlesEvent,
  ClassSessionMeetingOperationResultEvent,
} from '@application/events';
import { NotificationQueueService } from '@core/notification/services/notification-queue.service';
import { FeishuCalendarService } from '@core/calendar/services/feishu-calendar.service';
import { UserService } from '@domains/identity/user/user-service';
import { ClassSessionDomainService } from '@domains/services/class/class-sessions/services/class-session-domain.service';
import { ClassSessionRepository } from '@domains/services/class/class-sessions/infrastructure/repositories/class-session.repository';

/**
 * Class Session Notification Handler
 * 
 * Handles notification and calendar operations for class sessions
 * Listens to MEETING_OPERATION_RESULT_EVENT and orchestrates:
 * 1. Calendar event creation/update/cancellation (Feishu)
 * 2. Notification queue management (schedule/update/cancel reminders)
 * 
 * Event Flow:
 * - Create Success: Create calendar + Schedule reminders
 * - Create Failed: (No action needed)
 * - Update Success: Update calendar + Update reminders
 * - Update Failed: (No action needed)
 * - Cancel Success: Cancel calendar + Cancel reminders
 * - Cancel Failed: (No action needed)
 */
@Injectable()
export class ClassSessionNotificationHandler {
  private readonly logger = new Logger(ClassSessionNotificationHandler.name);

  constructor(
    private readonly notificationQueueService: NotificationQueueService,
    private readonly feishuCalendarService: FeishuCalendarService,
    private readonly userService: UserService,
    private readonly classSessionService: ClassSessionDomainService,
    private readonly classSessionRepository: ClassSessionRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handle meeting operation result event
   * Main entry point for all meeting lifecycle operations
   */
  @OnEvent(ClassSessionMeetingOperationResultEvent.eventType)
  @HandlesEvent(
    ClassSessionMeetingOperationResultEvent.eventType,
    ClassSessionNotificationHandler.name,
  )
  async handleMeetingOperationResult(
    event: ClassSessionMeetingOperationResultEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling MEETING_OPERATION_RESULT_EVENT: operation=${payload.operation}, status=${payload.status}, sessionId=${payload.sessionId}`,
    );

    try {
      // Route to specific handler based on operation and status
      if (payload.operation === 'create' && payload.status === 'success') {
        await this.handleCreateSuccess(payload);
      } else if (payload.operation === 'create' && payload.status === 'failed') {
        await this.handleCreateFailed(payload);
      } else if (payload.operation === 'update' && payload.status === 'success') {
        await this.handleUpdateSuccess(payload);
      } else if (payload.operation === 'update' && payload.status === 'failed') {
        await this.handleUpdateFailed(payload);
      } else if (payload.operation === 'cancel' && payload.status === 'success') {
        await this.handleCancelSuccess(payload);
      } else if (payload.operation === 'cancel' && payload.status === 'failed') {
        await this.handleCancelFailed(payload);
      }
    } catch (error) {
      this.logger.error(
        `Error handling meeting operation result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      // Don't throw - we don't want to break the event flow
    }
  }

  /**
   * Handle create success
   * 1. Create Feishu calendar event with all parties
   * 2. Schedule reminders (3 days, 1 day, 3 hours before)
   */
  private async handleCreateSuccess(payload: any): Promise<void> {
    this.logger.log(`Handling create success for session ${payload.sessionId}`);

    try {
      // Get session to retrieve title
      const session = await this.classSessionService.findById(payload.sessionId);
      const sessionTitle = session?.getTitle() || `Class Session ${new Date(payload.scheduledAt).toLocaleDateString()}`;

      // Get user emails (multiple counselors and students possible)
      const counselorEmails = payload.counselorIds
        ? await Promise.all(payload.counselorIds.map((id: string) => this.getUserEmail(id)))
        : [];
      const mentorEmail = await this.getUserEmail(payload.mentorId);
      const studentEmails = payload.studentIds
        ? await Promise.all(payload.studentIds.map((id: string) => this.getUserEmail(id)))
        : [];

      // Get user display names
      const counselorNames = payload.counselorIds
        ? await Promise.all(payload.counselorIds.map((id: string) => this.userService.getDisplayName(id)))
        : [];
      const mentorName = await this.userService.getDisplayName(payload.mentorId);
      
      // Get student names (used for both calendar and notification)
      const studentNames = payload.studentIds
        ? await Promise.all(payload.studentIds.map((id: string) => this.userService.getDisplayName(id)))
        : [];

      // Prepare calendar event data
      const scheduledAt = new Date(payload.scheduledAt);
      const endTime = new Date(scheduledAt.getTime() + payload.duration * 60 * 1000);

      // Create Feishu calendar event
      const calendarEnabled = this.configService.get<string>('ENABLE_CALENDAR_INTEGRATION') === 'true';
      
      if (calendarEnabled) {
        try {
          const attendees = [
            { email: mentorEmail, displayName: mentorName, isOptional: false },
          ];

          // Add students as attendees
          for (const email of studentEmails) {
            attendees.push({ email, displayName: 'Student', isOptional: false });
          }

          // Add counselors as optional attendees
          for (let i = 0; i < counselorEmails.length; i++) {
            attendees.push({ 
              email: counselorEmails[i], 
              displayName: counselorNames[i] || 'Counselor', 
              isOptional: true 
            });
          }
          
          const description = this.buildEventDescription(
            scheduledAt,
            endTime,
            sessionTitle, // Use actual session title instead of sessionId
            mentorName,
            counselorNames.join(', ') || undefined,
            studentNames,
            payload.meetingUrl,
          );

          const eventId = await this.feishuCalendarService.createEvent({
            summary: `Class Session: ${mentorName}`, // Class session - show mentor only (multiple students)
            startTime: scheduledAt,
            endTime,
            description,
            meetingUrl: payload.meetingUrl,
            attendees,
          });

          this.logger.log(`Created Feishu calendar event ${eventId} for session ${payload.sessionId}`);

          // Save eventId to session
          const session = await this.classSessionService.findById(payload.sessionId);
          if (session) {
            session.setFeishuCalendarEventId(eventId);
            await this.classSessionRepository.update(payload.sessionId, session);
            this.logger.log(`Saved calendar eventId to session ${payload.sessionId}`);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create calendar event (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      } else {
        this.logger.debug('Calendar integration disabled, skipping calendar event creation');
      }

      // Schedule reminders (for mentor, counselors and students)
      // Use comma-separated emails for multiple recipients
      await this.notificationQueueService.scheduleReminders({
        sessionId: payload.sessionId,
        scheduledAt,
        recipients: {
          counselorEmail: counselorEmails.length > 0 ? counselorEmails.join(',') : undefined,
          mentorEmail,
          studentEmail: studentEmails.length > 0 ? studentEmails.join(',') : mentorEmail, // Fallback to mentor if no students
        },
        sessionInfo: {
          title: sessionTitle, // Use actual session title from database
          meetingUrl: payload.meetingUrl,
          duration: payload.duration,
          sessionType: 'Class Session',
          mentorName: mentorName, // Use actual mentor name
          studentName: studentNames.length > 0 ? studentNames.join(', ') : 'Student', // Use actual student names
        },
      });

      this.logger.log(`Scheduled reminders for session ${payload.sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle create success for session ${payload.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
    }
  }

  /**
   * Handle create failed
   * No action needed - resources already released
   */
  private async handleCreateFailed(payload: any): Promise<void> {
    this.logger.log(
      `Handling create failed for session ${payload.sessionId}: ${payload.errorMessage}`,
    );
    // No action needed
  }

  /**
   * Handle update success
   * 1. Update calendar event (time/title)
   * 2. Update reminders (new scheduled time)
   */
  private async handleUpdateSuccess(payload: any): Promise<void> {
    this.logger.log(`Handling update success for session ${payload.sessionId}`);

    try {
      // Update Feishu calendar event
      const session = await this.classSessionService.findById(payload.sessionId);
      if (!session) return;

      const eventId = session.getFeishuCalendarEventId();

      if (eventId && payload.newScheduledAt && payload.newDuration) {
        try {
          const newScheduledAt = new Date(payload.newScheduledAt);
          const newEndTime = new Date(newScheduledAt.getTime() + payload.newDuration * 60 * 1000);

          await this.feishuCalendarService.updateEvent(eventId, {
            startTime: newScheduledAt,
            endTime: newEndTime,
          });

          this.logger.log(`Updated Feishu calendar event ${eventId} for session ${payload.sessionId}`);
        } catch (error) {
          this.logger.warn(
            `Failed to update calendar event (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      } else {
        this.logger.debug(
          `Calendar update skipped - eventId not available for session ${payload.sessionId}`,
        );
      }

      // Update reminders
      if (payload.newScheduledAt) {
        await this.notificationQueueService.updateReminders(
          payload.sessionId,
          new Date(payload.newScheduledAt),
        );

        this.logger.log(`Updated reminders for session ${payload.sessionId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle update success for session ${payload.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
    }
  }

  /**
   * Handle update failed
   * No action needed
   */
  private async handleUpdateFailed(payload: any): Promise<void> {
    this.logger.log(
      `Handling update failed for session ${payload.sessionId}: ${payload.errorMessage}`,
    );
    // No action needed
  }

  /**
   * Handle cancel success
   * 1. Cancel calendar event
   * 2. Cancel all pending reminders
   */
  private async handleCancelSuccess(payload: any): Promise<void> {
    this.logger.log(`Handling cancel success for session ${payload.sessionId}`);

    try {
      // Cancel Feishu calendar event
      const session = await this.classSessionService.findById(payload.sessionId);
      if (!session) return;

      const eventId = session.getFeishuCalendarEventId();

      if (eventId) {
        try {
          await this.feishuCalendarService.cancelEvent(eventId);
          this.logger.log(`Cancelled Feishu calendar event ${eventId} for session ${payload.sessionId}`);
        } catch (error) {
          this.logger.warn(
            `Failed to cancel calendar event (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      } else {
        this.logger.debug(
          `Calendar cancellation skipped - eventId not available for session ${payload.sessionId}`,
        );
      }

      // Cancel all pending reminders
      await this.notificationQueueService.cancelReminders(payload.sessionId);

      this.logger.log(`Cancelled reminders for session ${payload.sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle cancel success for session ${payload.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
    }
  }

  /**
   * Handle cancel failed
   * No action needed
   */
  private async handleCancelFailed(payload: any): Promise<void> {
    this.logger.log(
      `Handling cancel failed for session ${payload.sessionId}: ${payload.errorMessage}`,
    );
    // No action needed
  }

  /**
   * Get user email by user ID
   */
  private async getUserEmail(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    if (!user || !user.email) {
      throw new Error(`User email not found for user ${userId}`);
    }
    return user.email;
  }

  /**
   * Build event description with multiple timezone conversions
   */
  private buildEventDescription(
    startTime: Date,
    endTime: Date,
    sessionTitle: string, // Changed from sessionId to sessionTitle
    mentorName: string,
    counselorName: string | undefined,
    studentNames: string[],
    meetingUrl: string,
  ): string {
    // Format time for different timezones
    const formatTime = (date: Date, timezone: string): string => {
      return date.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+:\d+)/, '$3-$1-$2 $4');
    };

    const timezones = [
      { name: 'PST', zone: 'America/Los_Angeles' },
      { name: 'CST', zone: 'America/Chicago' },
      { name: 'EST', zone: 'America/New_York' },
      { name: 'UK', zone: 'Europe/London' },
      { name: 'Shanghai', zone: 'Asia/Shanghai' },
    ];

    const timeStrings = timezones.map(tz => {
      const start = formatTime(startTime, tz.zone);
      const end = formatTime(endTime, tz.zone).split(' ')[1]; // Only time part
      return `Date/Time(Timezone: ${tz.name}): ${start} - ${end}`;
    }).join('\n');

    return `${timeStrings}

Session: ${sessionTitle}
Mentor: ${mentorName}${counselorName ? `\nCounselor: ${counselorName}` : ''}${studentNames.length > 0 ? `\nStudents: ${studentNames.join(', ')}` : ''}

Meeting URL: ${meetingUrl}
You can join this meeting from your browser.

Powered by SuperAcademy`;
  }
}

