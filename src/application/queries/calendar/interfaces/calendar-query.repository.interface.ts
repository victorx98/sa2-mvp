import { CalendarEventReadModel } from '../models/calendar-event-read.model';
import { QueryCalendarEventsDto } from '../dto/calendar-event-query.dto';

export const CALENDAR_QUERY_REPOSITORY = Symbol('CALENDAR_QUERY_REPOSITORY');

export interface ICalendarQueryRepository {
  getCalendarEvents(dto: QueryCalendarEventsDto): Promise<CalendarEventReadModel[]>;
}
