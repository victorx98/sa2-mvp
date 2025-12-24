import { Injectable, Logger } from '@nestjs/common';
import { CalendarService } from '@core/calendar';
import { UserType } from '@core/calendar/interfaces/calendar-slot.interface';

// DTOs
export interface GetCalendarEventsDto {
  userId: string;
  userType: UserType;
  startDate?: Date;
  endDate?: Date;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  sessionType: string;
  status: string;
  metadata: {
    meetingUrl?: string;
    otherPartyName?: string;
  };
}

/**
 * Calendar Query Service
 * 
 * Responsibility:
 * - Query calendar events for users (mentor/student)
 * - Transform calendar slots to calendar event format
 * - Support date range filtering
 */
@Injectable()
export class CalendarQueryService {
  private readonly logger = new Logger(CalendarQueryService.name);

  constructor(private readonly calendarService: CalendarService) {}

  /**
   * Get calendar events for a user
   * Returns all events (booked/completed/cancelled) for calendar view
   * 
   * @param dto - Query parameters
   * @returns Array of calendar events
   */
  async getCalendarEvents(dto: GetCalendarEventsDto): Promise<CalendarEventDto[]> {
    this.logger.log(
      `Fetching calendar events: userId=${dto.userId}, userType=${dto.userType}`,
    );

    // Query calendar slots from core layer
    const slots = await this.calendarService.getCalendarEventsByUser(
      dto.userId,
      dto.userType,
      dto.startDate,
      dto.endDate,
    );

    // Transform to calendar event format
    return slots.map((slot) => ({
      id: slot.id,
      title: slot.title,
      startTime: slot.scheduledStartTime.toISOString(),
      endTime: slot.timeRange.end.toISOString(),
      duration: slot.durationMinutes,
      sessionType: slot.sessionType,
      status: slot.status,
      metadata: {
        meetingUrl: slot.metadata?.meetingUrl,
        otherPartyName: slot.metadata?.otherPartyName,
      },
    }));
  }
}

