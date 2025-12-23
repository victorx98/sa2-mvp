import { Inject, Injectable, Logger } from '@nestjs/common';
import { IMockInterviewRepository, MOCK_INTERVIEW_REPOSITORY } from '../repositories/mock-interview.repository.interface';
import { MockInterview } from '../entities/mock-interview.entity';
import { InterviewNotFoundException } from '../exceptions/exceptions';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Mock Interview Domain Service
 * 
 * Responsibility: Pure business logic, no transactions, events, or external services
 * 
 * Key features:
 * - Does NOT register service to service_references (not billable)
 * - Does NOT emit services.session.completed event
 * - Simplified workflow: only updates mock_interviews status
 */
@Injectable()
export class MockInterviewDomainService {
  private readonly logger = new Logger(MockInterviewDomainService.name);

  constructor(
    @Inject(MOCK_INTERVIEW_REPOSITORY)
    private readonly repository: IMockInterviewRepository,
  ) {}

  /**
   * Create interview
   */
  async createInterview(
    props: {
      id: string;
      sessionType: string;
      studentUserId: string;
      createdByCounselorId?: string;
      title: string;
      scheduledAt: Date;
      scheduleDuration?: number;
      interviewType?: string;
      language?: string;
      companyName?: string;
      jobTitle?: string;
      jobDescription?: string;
      resumeText?: string;
      studentInfo?: any;
      interviewQuestions?: any[];
      interviewInstructions?: string;
      systemInstruction?: string;
      serviceType?: string;
    },
    tx?: DrizzleTransaction,
  ): Promise<MockInterview> {
    this.logger.log(`Creating mock interview for student ${props.studentUserId}`);
    
    const interview = MockInterview.create(props);
    await this.repository.save(interview, tx);
    
    return interview;
  }

  /**
   * Complete interview
   * SCHEDULED → COMPLETED
   */
  async completeInterview(
    interviewId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Completing interview ${interviewId}`);
    
    const interview = await this.repository.findById(interviewId);
    if (!interview) {
      throw new InterviewNotFoundException(interviewId);
    }
    
    interview.complete();
    await this.repository.update(interview, tx);
  }

  /**
   * Cancel interview
   * SCHEDULED → CANCELLED
   */
  async cancelInterview(
    interviewId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Cancelling interview ${interviewId}`);
    
    const interview = await this.repository.findById(interviewId);
    if (!interview) {
      throw new InterviewNotFoundException(interviewId);
    }
    
    interview.cancel();
    await this.repository.update(interview, tx);
  }

  /**
   * Update interview information
   */
  async updateInterview(
    interviewId: string,
    props: {
      title?: string;
      scheduledAt?: Date;
      scheduleDuration?: number;
      interviewType?: string;
      language?: string;
      companyName?: string;
      jobTitle?: string;
      jobDescription?: string;
      resumeText?: string;
      interviewInstructions?: string;
      systemInstruction?: string;
    },
    tx?: DrizzleTransaction,
  ): Promise<MockInterview> {
    this.logger.log(`Updating interview ${interviewId}`);
    
    const interview = await this.repository.findById(interviewId);
    if (!interview) {
      throw new InterviewNotFoundException(interviewId);
    }
    
    interview.updateInfo(props);
    await this.repository.update(interview, tx);
    
    return interview;
  }

  /**
   * Soft delete interview
   */
  async deleteInterview(
    interviewId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Deleting interview ${interviewId}`);
    
    const interview = await this.repository.findById(interviewId);
    if (!interview) {
      throw new InterviewNotFoundException(interviewId);
    }
    
    interview.softDelete();
    await this.repository.update(interview, tx);
  }

  /**
   * Get interview by ID
   */
  async getInterviewById(id: string): Promise<MockInterview> {
    const interview = await this.repository.findById(id);
    if (!interview) {
      throw new InterviewNotFoundException(id);
    }
    return interview;
  }
}

