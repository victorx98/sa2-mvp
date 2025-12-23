import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, inArray, and, ne, desc } from 'drizzle-orm';
import { InterviewStatus } from '@domains/services/mock-interviews/value-objects/interview-status.vo';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { mockInterviews } from '@infrastructure/database/schema/mock-interviews.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { InterviewNotFoundException } from '@domains/services/mock-interviews/exceptions/exceptions';

/**
 * Mock Interview Query Service (CQRS - Query)
 * 
 * Cross-domain Read Model: One-time JOIN across multiple domains
 * Directly queries: mock_interviews + users
 * No dependency on Repository for read operations
 */
@Injectable()
export class MockInterviewQueryService {
  private readonly logger = new Logger(MockInterviewQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get student's interviews with user names
   */
  async getStudentInterviews(
    studentId: string,
    filters?: {
      status?: InterviewStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 10,
    offset: number = 0,
  ): Promise<any[]> {
    this.logger.log(`Getting mock interviews for student: ${studentId}`);

    const excludeDeleted = filters?.excludeDeleted !== false;
    
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

    // Batch enrich user names
    return this.enrichWithUserNames(results);
  }

  /**
   * Get counselor's created interviews
   */
  async getCounselorInterviews(
    counselorId: string,
    filters?: {
      status?: InterviewStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 10,
    offset: number = 0,
  ): Promise<any[]> {
    this.logger.log(`Getting mock interviews for counselor: ${counselorId}`);

    const excludeDeleted = filters?.excludeDeleted !== false;
    
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

  /**
   * Get interviews by multiple student IDs (for counselor viewing all students)
   */
  async getInterviewsByStudentIds(
    studentIds: string[],
    filters?: {
      status?: InterviewStatus;
      excludeDeleted?: boolean;
    },
    limit: number = 50,
    offset: number = 0,
  ): Promise<any[]> {
    this.logger.log(`Getting mock interviews for ${studentIds.length} students`);

    if (studentIds.length === 0) {
      return [];
    }

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
      .orderBy(desc(mockInterviews.scheduledAt))
      .limit(limit)
      .offset(offset);

    return this.enrichWithUserNames(results);
  }

  /**
   * Get interview by ID with user names
   */
  async getInterviewById(interviewId: string): Promise<any> {
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

  /**
   * Enrich results with user names (batch query)
   */
  private async enrichWithUserNames(results: any[]): Promise<any[]> {
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
}

