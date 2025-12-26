import { SessionStatus } from '@domains/services/sessions/gap-analysis/value-objects/session-status.vo';

export const GAP_ANALYSIS_QUERY_REPOSITORY = Symbol('GAP_ANALYSIS_QUERY_REPOSITORY');

export interface GapAnalysisQueryDto {
  status?: SessionStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface GapAnalysisMeetingInfo {
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

export interface GapAnalysisReadModel {
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
  meeting: GapAnalysisMeetingInfo | undefined;
  aiSummaries: any[];
  createdAt: string;
  updatedAt: string;
}

export interface IGapAnalysisQueryRepository {
  getMentorSessions(
    mentorId: string,
    filters?: GapAnalysisQueryDto,
  ): Promise<GapAnalysisReadModel[]>;

  getStudentSessions(
    studentId: string,
    filters?: GapAnalysisQueryDto,
  ): Promise<GapAnalysisReadModel[]>;

  getSessionsByStudentIds(
    studentIds: string[],
    filters?: GapAnalysisQueryDto,
  ): Promise<GapAnalysisReadModel[]>;

  getSessionById(id: string): Promise<GapAnalysisReadModel>;
}
