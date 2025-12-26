import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { mockInterviews } from '@infrastructure/database/schema/mock-interviews.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import {
  IMockInterviewQueryRepository,
  MockInterviewFilters,
  MockInterviewReadModel,
} from '../../interfaces/mock-interview-query.repository.interface';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { InterviewNotFoundException } from '@domains/services/mock-interviews/exceptions/exceptions';

@Injectable()
export class DrizzleMockInterviewQueryRepository implements IMockInterviewQueryRepository {
  private readonly logger = new Logger(DrizzleMockInterviewQueryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  private async countInterviews(
    whereConditions: any[],
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(mockInterviews)
      .where(and(...whereConditions));
    return result.count || 0;
  }

  private async enrichWithUserNames(results: any[]): Promise<MockInterviewReadModel[]> {
    if (results.length === 0) {
      return [];
    }

    // Collect all unique user IDs
    const userIds = new Set<string>();
    results.forEach(row => {
      const interview = row.interview;
      if (interview.studentUserId) userIds.add(interview.studentUserId);
      if (interview.createdByCounselorId) userIds.add(interview.createdByCounselorId);
    });

    // Batch fetch user names
    const users = await this.db
      .select({
        id: userTable.id,
        nameEn: userTable.nameEn,
        nameZh: userTable.nameZh,
      })
      .from(userTable)
      .where(inArray(userTable.id, Array.from(userIds)));

    // Create user map
    const userMap = new Map(
      users.map(user => [
        user.id,
        {
          en: user.nameEn || '',
          zh: user.nameZh || '',
        },
      ]),
    );

    // Enrich results
    return results.map(row => {
      const interview = row.interview;
      return {
        id: interview.id,
        sessionType: interview.sessionType,
        studentUserId: interview.studentUserId,
        studentName: userMap.get(interview.studentUserId) || { en: '', zh: '' },
        createdByCounselorId: interview.createdByCounselorId,
        createdByCounselorName: interview.createdByCounselorId
          ? userMap.get(interview.createdByCounselorId) || { en: '', zh: '' }
          : null,
        title: interview.title,
        status: interview.status,
        scheduledAt: interview.scheduledAt,
        scheduleDuration: interview.scheduleDuration,
        completedAt: interview.completedAt,
        cancelledAt: interview.cancelledAt,
        deletedAt: interview.deletedAt,
        interviewType: interview.interviewType,
        language: interview.language,
        companyName: interview.companyName,
        jobTitle: interview.jobTitle,
        jobDescription: interview.jobDescription,
        resumeText: interview.resumeText,
        studentInfo: interview.studentInfo,
        interviewQuestions: interview.interviewQuestions,
        interviewInstructions: interview.interviewInstructions,
        systemInstruction: interview.systemInstruction,
        serviceType: interview.serviceType,
        aiSummaries: interview.aiSummaries,
        createdAt: interview.createdAt,
        updatedAt: interview.updatedAt,
      };
    });
  }

  async getStudentInterviews(
    studentId: string,
    page: number = 1,
    pageSize: number = 10,
    filters?: MockInterviewFilters,
  ): Promise<IPaginatedResult<MockInterviewReadModel>> {
    this.logger.log(`Getting mock interviews for student: ${studentId}`);

    const excludeDeleted = filters?.excludeDeleted !== false;
    
    const whereConditions: any[] = [eq(mockInterviews.studentUserId, studentId)];
    if (excludeDeleted) {
      whereConditions.push(ne(mockInterviews.status, 'DELETED'));
    }
    if (filters?.status) {
      whereConditions.push(eq(mockInterviews.status, filters.status));
    }

    // Calculate total count
    const total = await this.countInterviews(whereConditions);

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Fetch data
    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(and(...whereConditions))
      .orderBy(desc(mockInterviews.scheduledAt))
      .limit(pageSize)
      .offset(offset);

    // Batch enrich user names
    const data = await this.enrichWithUserNames(results);

    // Calculate total pages
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getCounselorInterviews(
    counselorId: string,
    page: number = 1,
    pageSize: number = 10,
    filters?: MockInterviewFilters,
  ): Promise<IPaginatedResult<MockInterviewReadModel>> {
    this.logger.log(`Getting mock interviews for counselor: ${counselorId}`);

    const excludeDeleted = filters?.excludeDeleted !== false;
    
    const whereConditions: any[] = [eq(mockInterviews.createdByCounselorId, counselorId)];
    if (excludeDeleted) {
      whereConditions.push(ne(mockInterviews.status, 'DELETED'));
    }
    if (filters?.status) {
      whereConditions.push(eq(mockInterviews.status, filters.status));
    }

    // Calculate total count
    const total = await this.countInterviews(whereConditions);

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Fetch data
    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(and(...whereConditions))
      .orderBy(desc(mockInterviews.scheduledAt))
      .limit(pageSize)
      .offset(offset);

    // Batch enrich user names
    const data = await this.enrichWithUserNames(results);

    // Calculate total pages
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getInterviewsByStudentIds(
    studentIds: string[],
    page: number = 1,
    pageSize: number = 50,
    filters?: MockInterviewFilters,
  ): Promise<IPaginatedResult<MockInterviewReadModel>> {
    this.logger.log(`Getting mock interviews for ${studentIds.length} students`);

    if (studentIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    const excludeDeleted = filters?.excludeDeleted !== false;
    
    const whereConditions: any[] = [inArray(mockInterviews.studentUserId, studentIds)];
    if (excludeDeleted) {
      whereConditions.push(ne(mockInterviews.status, 'DELETED'));
    }
    if (filters?.status) {
      whereConditions.push(eq(mockInterviews.status, filters.status));
    }

    // Calculate total count
    const total = await this.countInterviews(whereConditions);

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Fetch data
    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(and(...whereConditions))
      .orderBy(desc(mockInterviews.scheduledAt))
      .limit(pageSize)
      .offset(offset);

    // Batch enrich user names
    const data = await this.enrichWithUserNames(results);

    // Calculate total pages
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getInterviewById(interviewId: string): Promise<MockInterviewReadModel> {
    this.logger.log(`Getting mock interview by ID: ${interviewId}`);

    const results = await this.db
      .select({
        interview: mockInterviews,
      })
      .from(mockInterviews)
      .where(eq(mockInterviews.id, interviewId))
      .limit(1);

    if (!results[0]) {
      throw new InterviewNotFoundException(interviewId);
    }

    const enriched = await this.enrichWithUserNames(results);
    return enriched[0];
  }
}