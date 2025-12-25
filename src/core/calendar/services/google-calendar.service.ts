import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import {
  ICalendarService,
  ICreateCalendarEventDto,
  IUpdateCalendarEventDto,
} from '@core/notification/interfaces';

/**
 * Google Calendar Service
 * 
 * Manages Google Calendar events via Google Calendar API
 * Supports create, update, cancel operations
 * 
 * Note: Google Calendar supports external emails natively in attendees field
 * No separate API call needed to add attendees
 */
@Injectable()
export class GoogleCalendarService implements ICalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly calendar: calendar_v3.Calendar;
  private readonly calendarId: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize Google Calendar client
    const credentials = this.configService.get<string>('GOOGLE_CALENDAR_CREDENTIALS');
    
    if (!credentials) {
      this.logger.warn('Google Calendar credentials not configured');
    }

    // Parse credentials JSON
    const auth = new google.auth.GoogleAuth({
      credentials: credentials ? JSON.parse(credentials) : undefined,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
    this.calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID', 'primary');
  }

  /**
   * Create calendar event
   * Google Calendar supports external emails directly in attendees field
   * 
   * @param dto - Create calendar event DTO
   * @returns Event ID
   */
  async createEvent(dto: ICreateCalendarEventDto): Promise<string> {
    try {
      const event: calendar_v3.Schema$Event = {
        summary: dto.summary,
        description: dto.description || '',
        start: {
          dateTime: dto.startTime.toISOString(),
          timeZone: 'Asia/Shanghai',
        },
        end: {
          dateTime: dto.endTime.toISOString(),
          timeZone: 'Asia/Shanghai',
        },
        attendees: dto.attendees.map((attendee) => ({
          email: attendee.email,
          displayName: attendee.displayName,
          optional: attendee.isOptional || false,
        })),
        conferenceData: dto.meetingUrl
          ? {
              entryPoints: [
                {
                  entryPointType: 'video',
                  uri: dto.meetingUrl,
                  label: dto.meetingUrl,
                },
              ],
            }
          : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        sendUpdates: 'all', // Send email invitations to all attendees
      });

      const eventId = response.data.id;
      if (!eventId) {
        throw new Error('Failed to get event ID from Google Calendar response');
      }

      this.logger.log(`Created Google Calendar event: ${eventId}`);
      return eventId;
    } catch (error) {
      this.logger.error(
        `Failed to create Google Calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Update calendar event
   * 
   * @param eventId - Event ID
   * @param updates - Update fields
   */
  async updateEvent(eventId: string, updates: IUpdateCalendarEventDto): Promise<void> {
    try {
      // Fetch existing event first
      const existingEvent = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId,
      });

      const event: calendar_v3.Schema$Event = {
        ...existingEvent.data,
      };

      // Apply updates
      if (updates.summary) {
        event.summary = updates.summary;
      }

      if (updates.description !== undefined) {
        event.description = updates.description;
      }

      if (updates.startTime && updates.endTime) {
        event.start = {
          dateTime: updates.startTime.toISOString(),
          timeZone: 'Asia/Shanghai',
        };
        event.end = {
          dateTime: updates.endTime.toISOString(),
          timeZone: 'Asia/Shanghai',
        };
      }

      if (updates.meetingUrl) {
        event.conferenceData = {
          entryPoints: [
            {
              entryPointType: 'video',
              uri: updates.meetingUrl,
              label: updates.meetingUrl,
            },
          ],
        };
      }

      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId,
        requestBody: event,
        sendUpdates: 'all', // Send update notifications to all attendees
      });

      this.logger.log(`Updated Google Calendar event: ${eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update Google Calendar event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Cancel calendar event
   * 
   * @param eventId - Event ID
   */
  async cancelEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all', // Send cancellation notifications to all attendees
      });

      this.logger.log(`Cancelled Google Calendar event: ${eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to cancel Google Calendar event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }
}

