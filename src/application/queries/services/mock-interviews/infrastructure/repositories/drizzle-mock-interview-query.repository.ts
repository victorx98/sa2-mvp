import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { mockInterviews } from '@infrastructure/database/schema/mock-interviews.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { InterviewStatus } from '@domains/services/mock-interviews/value-objects/interview-status.vo';
import {
  IMockInterviewQueryRepository,
  MOCK_INTERVIEW_QUERY_REPOSITORY,
  MockInterviewQueryDto,
  MockInterviewReadModel,
} from '../../interfaces/mock-interview-query.repository.interface';

@Injectable()
export class DrizzleMockInterviewQueryRepository implements IMockInterviewQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async getStudentInterviews(
    studentId: string,
    filters?: MockInterviewQueryDto,
  ): Promise<MockInterviewReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(mockInterviews.studentUserId, studentId)];
    if (excludeDeleted) {
      whereConditions.push(ne(mockInterviews.status, InterviewStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(mockInterviews.status, filters.status));
    }

    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(and(...whereConditions))
      .orderBy(desc(mockInterviews.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getCounselorInterviews(
    counselorId: string,
    filters?: MockInterviewQueryDto,
  ): Promise<MockInterviewReadModel[]> {
    const excludeDeleted = filters?.excludeDeleted !== false;
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const whereConditions: any[] = [eq(mockInterviews.createdByCounselorId, counselorId)];
    if (excludeDeleted) {
      whereConditions.push(ne(mockInterviews.status, InterviewStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(mockInterviews.status, filters.status));
    }

    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(and(...whereConditions))
      .orderBy(desc(mockInterviews.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  async getInterviewsByStudentIds(
    studentIds: string[],
    filters?: MockInterviewQueryDto,
  ): Promise<MockInterviewReadModel[]> {
    if (studentIds.length === 0) return [];

    const excludeDeleted = filters?.excludeDeleted !== false;

    const whereConditions: any[] = [inArray(mockInterviews.studentUserId, studentIds)];
    if (excludeDeleted) {
      whereConditions.push(ne(mockInterviews.status, InterviewStatus.DELETED));
    }
    if (filters?.status) {
      whereConditions.push(eq(mockInterviews.status, filters.status));
    }

    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(and(...whereConditions))
      .orderBy(desc(mockInterviews.scheduledAt));

    return this.enrichWithUserNames(results);
  }

  async getInterviewById(id: string): Promise<MockInterviewReadModel> {
    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(eq(mockInterviews.id, id));

    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }

  private async enrichWithUserNames(
    results: Array<{ interview: any }>,
  ): Promise<MockInterviewReadModel[]> {
    if (results.length === 0) return [];

    const userIds = new Set<string>();
    results.forEach(({ interview }) => {
      if (interview.studentUserId) userIds.add(interview.studentUserId);
      if (interview.mentorUserId) userIds.add(interview.mentorUserId);
      if (interview.counselorUserId) userIds.add(interview.counselorUserId);
      if (interview.createdByCounselorId) userIds.add(interview.createdByCounselorId);
    });

    const userIdsArray = Array.from(userIds);
    const users = userIdsArray.length > 0
      ? await this.db.select().from(userTable).where(inArray(userTable.id, userIdsArray as any))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const formatUserName = (userId: string) => {
      const user = userMap.get(userId);
      if (!user) return null;
      return {
        en: user.nameEn || '',
        zh: user.nameZh || '',
      };
    };

    return results.map(({ interview }) => ({
      id: interview.id,
      sessionType: interview.sessionType || 'mock-interview',
      studentUserId: interview.studentUserId,
      mentorUserId: interview.mentorUserId,
      counselorUserId: interview.counselorUserId,
      createdByCounselorId: interview.createdByCounselorId,
      title: interview.title,
      description: interview.description,
      interviewType: interview.interviewType,
      interviewRole: interview.interviewRole,
      companyName: interview.companyName,
      status: interview.status,
      scheduledAt: interview.scheduledAt ? interview.scheduledAt.toISOString() : null,
      scheduleDuration: interview.duration || null,
      completedAt: interview.completedAt ? interview.completedAt.toISOString() : null,
      cancelledAt: interview.cancelledAt ? interview.cancelledAt.toISOString() : null,
      duration: interview.duration,
      studentName: formatUserName(interview.studentUserId),
      mentorName: interview.mentorUserId ? formatUserName(interview.mentorUserId) : null,
      counselorName: interview.counselorUserId ? formatUserName(interview.counselorUserId) : null,
      feedback: interview.feedback,
      rating: interview.rating,
      aiFeedback: interview.aiFeedback,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
    }));
  }
}
