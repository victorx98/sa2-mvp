import { Injectable, Logger } from '@nestjs/common';
import { CalendarService } from '@core/calendar';
import { ICalendarQueryRepository } from '../../interfaces/calendar-query.repository.interface';
import { QueryCalendarEventsDto } from '../../dto/calendar-event-query.dto';
import { CalendarEventReadModel } from '../../models/calendar-event-read.model';

@Injectable()
export class CalendarQueryRepository implements ICalendarQueryRepository {
  private readonly logger = new Logger(CalendarQueryRepository.name);

  constructor(private readonly calendarService: CalendarService) {}

  async getCalendarEvents(dto: QueryCalendarEventsDto): Promise<CalendarEventReadModel[]> {
    this.logger.log(
      `Fetching calendar events: userId=${dto.userId}, userType=${dto.userType}`,
    );

    const slots = await this.calendarService.getCalendarEventsByUser(
      dto.userId,
      dto.userType,
      dto.startDate,
      dto.endDate,
    );

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
