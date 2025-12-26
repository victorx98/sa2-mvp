import { UserType } from '@core/calendar/interfaces/calendar-slot.interface';

export interface CalendarEventReadModel {
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

export interface GetCalendarEventsDto {
  userId: string;
  userType: UserType;
  startDate?: Date;
  endDate?: Date;
}
