import { ClassSessionStatus } from '@domains/services/class';

export const CLASS_SESSION_QUERY_REPOSITORY = Symbol('CLASS_SESSION_QUERY_REPOSITORY');

export interface ClassSessionQueryDto {
  status?: ClassSessionStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ClassSessionMeetingInfo {
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

export interface ClassSessionReadModel {
  id: string;
  classId: string;
  meetingId: string | null;
  mentorUserId: string;
  createdByCounselorId: string | null; // Counselor who created the session
  title: string;
  description: string | null;
  status: ClassSessionStatus;
  scheduledAt: string | null;
  duration: number | null;
  scheduleStartTime: string | null;
  meetingProvider: string | null;
  mentorName: { en: string; zh: string } | null;
  meeting: ClassSessionMeetingInfo | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface IClassSessionQueryRepository {
  getSessionsByClass(
    classId: string,
    filters?: ClassSessionQueryDto,
  ): Promise<ClassSessionReadModel[]>;

  getMentorSessions(
    mentorId: string,
    filters?: ClassSessionQueryDto,
  ): Promise<ClassSessionReadModel[]>;

  getSessionById(id: string): Promise<ClassSessionReadModel>;
}
