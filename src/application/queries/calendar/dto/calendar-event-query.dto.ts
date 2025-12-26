import { UserType } from '@core/calendar/interfaces/calendar-slot.interface';

export interface QueryCalendarEventsDto {
  userId: string;
  userType: UserType;
  startDate?: Date;
  endDate?: Date;
}
