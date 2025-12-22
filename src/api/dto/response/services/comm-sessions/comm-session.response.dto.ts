import { ApiProperty } from '@nestjs/swagger';

/**
 * Meeting DTO
 */
export class MeetingDto {
  id: string;
  meetingNo: string;
  meetingProvider: string;
  meetingId: string;
  topic: string;
  meetingUrl: string;
  ownerId: string;
  scheduleStartTime: string;
  scheduleDuration: number;
  status: string;
  actualDuration?: number;
  meetingTimeList?: any[];
  recordingUrl?: string;
  lastMeetingEndedTimestamp?: string;
  pendingTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Communication Session Response DTO
 */
export class CommSessionResponseDto {
  id: string;
  meetingId: string;
  sessionType: string;
  studentUserId: string;
  studentName?: { en: string; zh: string };
  mentorUserId?: string;
  mentorName?: { en: string; zh: string };
  counselorUserId?: string;
  counselorName?: { en: string; zh: string };
  createdByCounselorId: string;
  createdByCounselorName?: { en: string; zh: string };
  title: string;
  description?: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  cancelledAt?: string;
  deletedAt?: string;
  aiSummaries?: any[];
  meeting?: MeetingDto;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Communication Session Response DTO
 */
export class CreateCommSessionResponseDto {
  @ApiProperty({
    description: 'Session ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Session Status',
    example: 'pending_meeting',
  })
  status: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
  })
  scheduledAt: string;
}

