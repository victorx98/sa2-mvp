import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  HandlesEvent,
  GapAnalysisSessionMeetingOperationResultEvent,
} from '@application/events';
import { NotificationQueueService } from '@core/notification/services/notification-queue.service';
import { FeishuCalendarService } from '@core/calendar/services/feishu-calendar.service';
import { UserService } from '@domains/identity/user/user-service';
import { GapAnalysisDomainService } from '@domains/services/sessions/gap-analysis/services/gap-analysis-domain.service';
import { DrizzleGapAnalysisRepository } from '@domains/services/sessions/gap-analysis/infrastructure/repositories/gap-analysis.repository';

/**
 * Gap Analysis Notification Handler
 * 
 * Handles notification and calendar operations for gap analysis sessions
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
export class GapAnalysisNotificationHandler {
  private readonly logger = new Logger(GapAnalysisNotificationHandler.name);

  constructor(
    private readonly notificationQueueService: NotificationQueueService,
    private readonly feishuCalendarService: FeishuCalendarService,
    private readonly userService: UserService,
    private readonly gapAnalysisService: GapAnalysisDomainService,
    private readonly gapAnalysisRepository: DrizzleGapAnalysisRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handle meeting operation result event
   * Main entry point for all meeting lifecycle operations
   */
  @OnEvent(GapAnalysisSessionMeetingOperationResultEvent.eventType)
  @HandlesEvent(
    GapAnalysisSessionMeetingOperationResultEvent.eventType,
    GapAnalysisNotificationHandler.name,
  )
  async handleMeetingOperationResult(
    event: GapAnalysisSessionMeetingOperationResultEvent,
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
      const session = await this.gapAnalysisService.getSessionById(payload.sessionId);
      const sessionTitle = session?.getTitle() || `Gap Analysis ${new Date(payload.scheduledAt).toLocaleDateString()}`;
      // Get user emails
      const counselorEmail = payload.counselorId
        ? await this.getUserEmail(payload.counselorId)
        : undefined;
      const mentorEmail = await this.getUserEmail(payload.mentorId);
      const studentEmail = await this.getUserEmail(payload.studentId);

      // Get user display names
      const counselorName = payload.counselorId
        ? await this.userService.getDisplayName(payload.counselorId)
        : undefined;
      const mentorName = await this.userService.getDisplayName(payload.mentorId);
      const studentName = await this.userService.getDisplayName(payload.studentId);

      // Prepare calendar event data
      const scheduledAt = new Date(payload.scheduledAt);
      const endTime = new Date(scheduledAt.getTime() + payload.duration * 60 * 1000);

      // Create Feishu calendar event
      const calendarEnabled = this.configService.get<string>('ENABLE_CALENDAR_INTEGRATION') === 'true';
      
      if (calendarEnabled) {
        try {
          const attendees = [
            { email: mentorEmail, displayName: mentorName, isOptional: false },
            { email: studentEmail, displayName: studentName, isOptional: false },
          ];

          if (counselorEmail && counselorName) {
            attendees.push({ email: counselorEmail, displayName: counselorName, isOptional: true });
          }

          // Build detailed description
          const description = this.buildEventDescription(
            scheduledAt,
            endTime,
            sessionTitle,
            studentName,
            mentorName,
            counselorName,
            payload.meetingUrl,
          );

          const eventId = await this.feishuCalendarService.createEvent({
            summary: `Gap Analysis Session: ${mentorName}/${studentName}`,
            startTime: scheduledAt,
            endTime,
            description,
            meetingUrl: payload.meetingUrl,
            attendees,
          });

          this.logger.log(`Created Feishu calendar event ${eventId} for session ${payload.sessionId}`);

          // Save eventId to session
          const session = await this.gapAnalysisService.getSessionById(payload.sessionId);
          session.setFeishuCalendarEventId(eventId);
          await this.gapAnalysisRepository.update(session);
          this.logger.log(`Saved calendar eventId to session ${payload.sessionId}`);
        } catch (error) {
          this.logger.warn(
            `Failed to create calendar event (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      } else {
        this.logger.debug('Calendar integration disabled, skipping calendar event creation');
      }

      // Schedule reminders
      await this.notificationQueueService.scheduleReminders({
        sessionId: payload.sessionId,
        scheduledAt,
        recipients: {
          counselorEmail,
          mentorEmail,
          studentEmail,
        },
        sessionInfo: {
          title: sessionTitle,
          meetingUrl: payload.meetingUrl,
          duration: payload.duration,
          sessionType: 'Gap Analysis Session',
          mentorName: mentorName,
          studentName: studentName,
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
      const session = await this.gapAnalysisService.getSessionById(payload.sessionId);
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
      const session = await this.gapAnalysisService.getSessionById(payload.sessionId);
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
    sessionId: string,
    studentName: string,
    mentorName: string,
    counselorName: string | undefined,
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

    // Extract session number from sessionId or use short ID

    return `${timeStrings}

Session: ${sessionId}
Student: ${studentName}
Mentor: ${mentorName}${counselorName ? `\nCounselor: ${counselorName}` : ''}

Meeting URL: ${meetingUrl}
You can join this meeting from your browser.

Powered by SuperAcademy`;
  }
}

