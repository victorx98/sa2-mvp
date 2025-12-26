import { InterviewStatus } from '@domains/services/mock-interviews/value-objects/interview-status.vo';
import { IPaginatedResult } from '@shared/types/paginated-result';

export const MOCK_INTERVIEW_QUERY_REPOSITORY = Symbol('MOCK_INTERVIEW_QUERY_REPOSITORY');

export interface MockInterviewFilters {
  status?: InterviewStatus;
  excludeDeleted?: boolean;
}

export interface MockInterviewReadModel {
  id: string;
  sessionType: string;
  studentUserId: string;
  studentName: { en: string; zh: string };
  createdByCounselorId: string;
  createdByCounselorName: { en: string; zh: string } | null;
  title: string;
  status: InterviewStatus;
  scheduledAt: Date;
  scheduleDuration: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  deletedAt: Date | null;
  interviewType: string;
  language: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  studentInfo: string;
  interviewQuestions: string[];
  interviewInstructions: string;
  systemInstruction: string;
  serviceType: string;
  aiSummaries: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMockInterviewQueryRepository {
  getStudentInterviews(
    studentId: string,
    page: number,
    pageSize: number,
    filters?: MockInterviewFilters
  ): Promise<IPaginatedResult<MockInterviewReadModel>>;

  getCounselorInterviews(
    counselorId: string,
    page: number,
    pageSize: number,
    filters?: MockInterviewFilters
  ): Promise<IPaginatedResult<MockInterviewReadModel>>;

  getInterviewsByStudentIds(
    studentIds: string[],
    page: number,
    pageSize: number,
    filters?: MockInterviewFilters
  ): Promise<IPaginatedResult<MockInterviewReadModel>>;

  getInterviewById(interviewId: string): Promise<MockInterviewReadModel>;
}