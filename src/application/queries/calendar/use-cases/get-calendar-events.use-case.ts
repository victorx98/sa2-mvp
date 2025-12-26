import { Injectable, Inject } from '@nestjs/common';
import { CalendarEventReadModel } from '../models/calendar-event-read.model';
import { QueryCalendarEventsDto } from '../dto/calendar-event-query.dto';
import { ICalendarQueryRepository, CALENDAR_QUERY_REPOSITORY } from '../interfaces/calendar-query.repository.interface';

@Injectable()
export class GetCalendarEventsUseCase {
  constructor(
    @Inject(CALENDAR_QUERY_REPOSITORY)
    private readonly calendarQueryRepository: ICalendarQueryRepository,
  ) {}

  async execute(dto: QueryCalendarEventsDto): Promise<CalendarEventReadModel[]> {
    return this.calendarQueryRepository.getCalendarEvents(dto);
  }
}
