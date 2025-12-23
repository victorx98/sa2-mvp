import { ApiProperty } from '@nestjs/swagger';

/**
 * Mock Interview Response DTO
 */
export class MockInterviewResponseDto {
  id: string;
  sessionType: string;
  studentUserId: string;
  studentName?: { en: string; zh: string };
  createdByCounselorId?: string;
  createdByCounselorName?: { en: string; zh: string };
  title: string;
  status: string;
  scheduledAt: string;
  scheduleDuration: number;
  completedAt?: string;
  cancelledAt?: string;
  deletedAt?: string;
  interviewType?: string;
  language?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  resumeText?: string;
  studentInfo?: any;
  interviewQuestions?: any[];
  interviewInstructions?: string;
  systemInstruction?: string;
  serviceType?: string;
  aiSummaries?: any[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Mock Interview Response DTO
 */
export class CreateMockInterviewResponseDto {
  @ApiProperty({
    description: 'Interview Session ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Interview Status',
    example: 'scheduled',
  })
  status: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-25T10:00:00Z',
  })
  scheduledAt: string | Date;
}

