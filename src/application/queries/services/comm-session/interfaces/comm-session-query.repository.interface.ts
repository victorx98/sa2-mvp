import { SessionStatus } from '@domains/services/comm-sessions/value-objects/session-status.vo';

export const COMM_SESSION_QUERY_REPOSITORY = Symbol('COMM_SESSION_QUERY_REPOSITORY');

export interface CommSessionQueryDto {
  status?: SessionStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface CommSessionMeetingInfo {
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

export interface CommSessionReadModel {
  id: string;
  sessionType: string;
  title: string;
  description: string | null;
  studentUserId: string;
  mentorUserId: string | null;
  counselorUserId: string | null;
  createdByCounselorId: string;
  meetingId: string | null;
  scheduledAt: string | null;
  status: SessionStatus;
  duration: number | null;
  scheduleStartTime: string | null;
  meetingProvider: string | null;
  studentName: { en: string; zh: string } | null;
  mentorName: { en: string; zh: string } | null;
  counselorName: { en: string; zh: string } | null;
  createdByCounselorName: { en: string; zh: string } | null;
  meeting: CommSessionMeetingInfo | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ICommSessionQueryRepository {
  getMentorSessions(
    mentorId: string,
    filters?: CommSessionQueryDto,
  ): Promise<CommSessionReadModel[]>;

  getStudentSessions(
    studentId: string,
    filters?: CommSessionQueryDto,
  ): Promise<CommSessionReadModel[]>;

  getSessionsByStudentIds(
    studentIds: string[],
    filters?: CommSessionQueryDto,
  ): Promise<CommSessionReadModel[]>;

  getSessionById(id: string): Promise<CommSessionReadModel>;
}
