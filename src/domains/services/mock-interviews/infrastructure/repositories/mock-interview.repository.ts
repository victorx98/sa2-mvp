import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { mockInterviews } from '@infrastructure/database/schema/mock-interviews.schema';
import { MockInterview } from '../../entities/mock-interview.entity';
import { IMockInterviewRepository } from '../../repositories/mock-interview.repository.interface';
import { InterviewStatus } from '../../value-objects/interview-status.vo';

/**
 * Mock Interview Repository Implementation
 * Handles data persistence using Drizzle ORM
 */
@Injectable()
export class MockInterviewRepository implements IMockInterviewRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async save(interview: MockInterview, tx?: DrizzleTransaction): Promise<void> {
    const executor = tx || this.db;
    
    await executor.insert(mockInterviews).values({
      id: interview.getId(),
      sessionType: interview.getSessionType(),
      studentUserId: interview.getStudentUserId(),
      createdByCounselorId: interview.getCreatedByCounselorId(),
      title: interview.getTitle(),
      status: interview.getStatus(),
      scheduledAt: interview.getScheduledAt(),
      scheduleDuration: interview.getScheduleDuration(),
      completedAt: interview.getCompletedAt(),
      cancelledAt: interview.getCancelledAt(),
      deletedAt: interview.getDeletedAt(),
      interviewType: interview.getInterviewType(),
      language: interview.getLanguage(),
      companyName: interview.getCompanyName(),
      jobTitle: interview.getJobTitle(),
      jobDescription: interview.getJobDescription(),
      resumeText: interview.getResumeText(),
      studentInfo: interview.getStudentInfo(),
      interviewQuestions: interview.getInterviewQuestions(),
      interviewInstructions: interview.getInterviewInstructions(),
      systemInstruction: interview.getSystemInstruction(),
      serviceType: interview.getServiceType(),
      aiSummaries: interview.getAiSummaries(),
      createdAt: interview.getCreatedAt(),
      updatedAt: interview.getUpdatedAt(),
    });
  }

  async update(interview: MockInterview, tx?: DrizzleTransaction): Promise<void> {
    const executor = tx || this.db;
    
    await executor
      .update(mockInterviews)
      .set({
        title: interview.getTitle(),
        status: interview.getStatus(),
        scheduledAt: interview.getScheduledAt(),
        scheduleDuration: interview.getScheduleDuration(),
        completedAt: interview.getCompletedAt(),
        cancelledAt: interview.getCancelledAt(),
        deletedAt: interview.getDeletedAt(),
        interviewType: interview.getInterviewType(),
        language: interview.getLanguage(),
        companyName: interview.getCompanyName(),
        jobTitle: interview.getJobTitle(),
        jobDescription: interview.getJobDescription(),
        resumeText: interview.getResumeText(),
        interviewInstructions: interview.getInterviewInstructions(),
        systemInstruction: interview.getSystemInstruction(),
        updatedAt: interview.getUpdatedAt(),
      })
      .where(eq(mockInterviews.id, interview.getId()));
  }

  async findById(id: string): Promise<MockInterview | null> {
    const result = await this.db
      .select()
      .from(mockInterviews)
      .where(eq(mockInterviews.id, id))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    return this.toDomain(result[0]);
  }

  async findByStudentId(studentId: string): Promise<MockInterview[]> {
    const results = await this.db
      .select()
      .from(mockInterviews)
      .where(eq(mockInterviews.studentUserId, studentId));

    return results.map(row => this.toDomain(row));
  }

  /**
   * Map database row to domain entity
   */
  private toDomain(row: any): MockInterview {
    return MockInterview.reconstitute({
      id: row.id,
      sessionType: row.sessionType,
      studentUserId: row.studentUserId,
      createdByCounselorId: row.createdByCounselorId,
      title: row.title,
      status: row.status as InterviewStatus,
      scheduledAt: new Date(row.scheduledAt),
      scheduleDuration: row.scheduleDuration,
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      cancelledAt: row.cancelledAt ? new Date(row.cancelledAt) : null,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      interviewType: row.interviewType,
      language: row.language,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      jobDescription: row.jobDescription,
      resumeText: row.resumeText,
      studentInfo: row.studentInfo,
      interviewQuestions: row.interviewQuestions,
      interviewInstructions: row.interviewInstructions,
      systemInstruction: row.systemInstruction,
      serviceType: row.serviceType,
      aiSummaries: row.aiSummaries,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}

