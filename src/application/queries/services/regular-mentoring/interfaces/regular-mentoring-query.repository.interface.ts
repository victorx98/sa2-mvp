import { SessionStatus } from '@domains/services/sessions/regular-mentoring/value-objects/session-status.vo';

export const REGULAR_MENTORING_QUERY_REPOSITORY = Symbol('REGULAR_MENTORING_QUERY_REPOSITORY');

export interface RegularMentoringQueryDto {
  status?: SessionStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface RegularMentoringMeetingInfo {
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

export interface RegularMentoringReadModel {
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
  duration: number | null;
  scheduleStartTime: string | null;
  meetingProvider: string | null;
  studentName: { en: string; zh: string } | null;
  mentorName: { en: string; zh: string } | null;
  counselorName: { en: string; zh: string } | null;
  meeting: RegularMentoringMeetingInfo | undefined;
  aiSummaries: any[];
  createdAt: string;
  updatedAt: string;
}

export interface IRegularMentoringQueryRepository {
  getMentorSessions(
    mentorId: string,
    filters?: RegularMentoringQueryDto,
  ): Promise<RegularMentoringReadModel[]>;

  getStudentSessions(
    studentId: string,
    filters?: RegularMentoringQueryDto,
  ): Promise<RegularMentoringReadModel[]>;

  getSessionsByStudentIds(
    studentIds: string[],
    filters?: RegularMentoringQueryDto,
  ): Promise<RegularMentoringReadModel[]>;

  getSessionById(id: string): Promise<RegularMentoringReadModel>;
}
