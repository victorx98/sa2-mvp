import { InterviewStatus } from '@domains/services/mock-interviews/value-objects/interview-status.vo';

export const MOCK_INTERVIEW_QUERY_REPOSITORY = Symbol('MOCK_INTERVIEW_QUERY_REPOSITORY');

export interface MockInterviewQueryDto {
  status?: InterviewStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface MockInterviewReadModel {
  id: string;
  sessionType: string;
  studentUserId: string;
  mentorUserId: string | null;
  counselorUserId: string | null;
  createdByCounselorId: string;
  title: string;
  description: string | null;
  interviewType: string;
  interviewRole: string;
  companyName: string | null;
  status: InterviewStatus;
  scheduledAt: string | null;
  scheduleDuration: number | null;
  completedAt: string | null;
  cancelledAt: string | null;
  duration: number | null;
  studentName: { en: string; zh: string } | null;
  mentorName: { en: string; zh: string } | null;
  counselorName: { en: string; zh: string } | null;
  feedback: string | null;
  rating: number | null;
  aiFeedback: any;
  createdAt: string;
  updatedAt: string;
}

export interface IMockInterviewQueryRepository {
  getStudentInterviews(
    studentId: string,
    filters?: MockInterviewQueryDto,
  ): Promise<MockInterviewReadModel[]>;

  getCounselorInterviews(
    counselorId: string,
    filters?: MockInterviewQueryDto,
  ): Promise<MockInterviewReadModel[]>;

  getInterviewsByStudentIds(
    studentIds: string[],
    filters?: MockInterviewQueryDto,
  ): Promise<MockInterviewReadModel[]>;

  getInterviewById(id: string): Promise<MockInterviewReadModel>;
}
