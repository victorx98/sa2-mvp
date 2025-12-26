import { SessionStatus } from '@domains/services/sessions/ai-career/value-objects/session-status.vo';

export const AI_CAREER_QUERY_REPOSITORY = Symbol('AI_CAREER_QUERY_REPOSITORY');

export interface AiCareerQueryDto {
  status?: SessionStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface AiCareerMeetingInfo {
  id: string;
  meetingNo: string;
  meetingId: string;
  meetingProvider: string;
  topic: string;
  meetingUrl: string;
  ownerId: string;
  scheduleStartTime: string | null;
  scheduleDuration: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiCareerReadModel {
  id: string;
  sessionType: string;
  sessionTypeId: string | null;
  serviceType: string | null;
  studentUserId: string;
  mentorUserId: string;
  createdByCounselorId: string | null;
  serviceHoldId: string | null;
  meetingId: string | null;
  title: string;
  description: string | null;
  status: SessionStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  feishuCalendarEventId: string | null;
  duration: number | null;
  scheduleStartTime: string | null;
  meetingProvider: string | null;
  studentName: { en: string; zh: string } | null;
  mentorName: { en: string; zh: string } | null;
  counselorName: { en: string; zh: string } | null;
  meeting: AiCareerMeetingInfo | undefined;
  aiSummaries: any[];
  createdAt: string;
  updatedAt: string;
}

export interface IAiCareerQueryRepository {
  getMentorSessions(
    mentorId: string,
    filters?: AiCareerQueryDto,
  ): Promise<AiCareerReadModel[]>;

  getStudentSessions(
    studentId: string,
    filters?: AiCareerQueryDto,
  ): Promise<AiCareerReadModel[]>;

  getSessionsByStudentIds(
    studentIds: string[],
    filters?: AiCareerQueryDto,
  ): Promise<AiCareerReadModel[]>;

  getSessionById(id: string): Promise<AiCareerReadModel>;
}
