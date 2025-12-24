import { ApiProperty } from '@nestjs/swagger';

/**
 * Calendar event metadata
 */
export class CalendarEventMetadataDto {
  @ApiProperty({
    description: 'Meeting URL',
    example: 'https://meeting.feishu.cn/j/123456',
    required: false,
  })
  meetingUrl?: string;

  @ApiProperty({
    description: 'Other party name (mentor/student name)',
    example: '张导师',
    required: false,
  })
  otherPartyName?: string;
}

/**
 * Calendar event DTO
 */
export class CalendarEventDto {
  @ApiProperty({
    description: 'Calendar slot ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Event title',
    example: 'AI职业规划课程',
  })
  title: string;

  @ApiProperty({
    description: 'Event start time (ISO 8601)',
    example: '2025-01-15T10:00:00Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'Event end time (ISO 8601)',
    example: '2025-01-15T11:00:00Z',
  })
  endTime: string;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 60,
  })
  duration: number;

  @ApiProperty({
    description: 'Session type',
    enum: ['regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session', 'mock_interview'],
    example: 'ai_career',
  })
  sessionType: string;

  @ApiProperty({
    description: 'Event status',
    enum: ['booked', 'completed', 'cancelled'],
    example: 'booked',
  })
  status: string;

  @ApiProperty({
    description: 'Event metadata',
    type: CalendarEventMetadataDto,
  })
  metadata: CalendarEventMetadataDto;
}

/**
 * Calendar events response DTO
 */
export class CalendarEventsResponseDto {
  @ApiProperty({
    description: 'List of calendar events',
    type: [CalendarEventDto],
  })
  events: CalendarEventDto[];
}

