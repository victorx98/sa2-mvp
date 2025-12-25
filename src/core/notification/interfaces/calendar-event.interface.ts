/**
 * Calendar Attendee DTO
 */
export interface IAttendeeDto {
  email: string;
  displayName?: string;
  isOptional?: boolean;
}

/**
 * Create Calendar Event DTO
 */
export interface ICreateCalendarEventDto {
  summary: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  meetingUrl?: string;
  attendees: IAttendeeDto[];
}

/**
 * Update Calendar Event DTO
 */
export interface IUpdateCalendarEventDto {
  summary?: string;
  startTime?: Date;
  endTime?: Date;
  description?: string;
  meetingUrl?: string;
}

/**
 * Calendar Service Interface
 */
export interface ICalendarService {
  createEvent(dto: ICreateCalendarEventDto): Promise<string>;
  updateEvent(eventId: string, updates: IUpdateCalendarEventDto): Promise<void>;
  cancelEvent(eventId: string): Promise<void>;
}

