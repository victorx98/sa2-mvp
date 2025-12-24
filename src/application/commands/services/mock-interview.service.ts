import { Inject, Injectable, Logger } from '@nestjs/common';
import { CalendarService } from '@core/calendar';
import {
  UserType,
  SessionType as CalendarSessionType,
} from '@core/calendar/interfaces/calendar-slot.interface';
import { TimeConflictException, NotFoundException } from '@shared/exceptions';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from '@shared/types/database.types';
import { Trace, addSpanAttributes, addSpanEvent } from '@shared/decorators/trace.decorator';
import { MetricsService } from '@telemetry/metrics.service';
import {
  IntegrationEventPublisher,
  MockInterviewCancelledEvent,
  MockInterviewCreatedEvent,
  MockInterviewUpdatedEvent,
} from '@application/events';
import { MockInterviewDomainService } from '@domains/services/mock-interviews/services/mock-interview-domain.service';
import { MockInterviewQueryService } from '@domains/query/services/mock-interview-query.service';

// DTOs
export interface CreateMockInterviewDto {
  studentId: string;
  createdByCounselorId?: string;
  title: string;
  scheduledAt: Date;
  duration?: number;
  interviewType?: string;
  language?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  resumeText?: string;
  interviewInstructions?: string;
  systemInstruction?: string;
}

export interface UpdateMockInterviewDto {
  title?: string;
  scheduledAt?: Date;
  duration?: number;
  interviewType?: string;
  language?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  resumeText?: string;
  interviewInstructions?: string;
  systemInstruction?: string;
}

/**
 * Application Layer - Mock Interview Service
 *
 * Responsibility:
 * - Orchestrate the complete flow of creating, updating, canceling mock interviews
 * - Coordinate between Core Services (Calendar)
 * - Handle transaction management
 * - Mock interviews are NOT billable - no service hold creation required
 * - No third-party meeting integration (WebRTC-based)
 */
@Injectable()
export class MockInterviewService {
  private readonly logger = new Logger(MockInterviewService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainService: MockInterviewDomainService,
    private readonly queryService: MockInterviewQueryService,
    private readonly calendarService: CalendarService,
    private readonly eventPublisher: IntegrationEventPublisher,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Create a new mock interview
   * Returns immediately with SCHEDULED status
   * No async meeting creation (WebRTC-based)
   *
   * @param dto Create interview input
   * @returns Created interview details with SCHEDULED status
   */
  @Trace({
    name: 'mock_interview.create',
    attributes: { 'operation.type': 'create' },
  })
  async createInterview(dto: CreateMockInterviewDto) {
    const startTime = Date.now();

    this.logger.log(
      `Creating mock interview: studentId=${dto.studentId}`,
    );

    addSpanAttributes({
      'student.id': dto.studentId,
      'counselor.id': dto.createdByCounselorId || 'none',
      'session.type': 'mock_interview',
    });

    try {
      addSpanEvent('interview.creation.start');

      const scheduledAtIso = dto.scheduledAt instanceof Date
        ? dto.scheduledAt.toISOString()
        : dto.scheduledAt;

      // Create calendar slot and interview record (no meeting creation)
      const interviewResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug('Starting database transaction for interview creation');

        const durationMinutes = dto.duration || 60;

        // Generate interview ID first
        const { randomUUID } = await import('crypto');
        const interviewId = randomUUID();

        // Create student calendar slot (ONLY student, no mentor/counselor)
        const studentCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.studentId,
            userType: UserType.STUDENT,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.MOCK_INTERVIEW,
            title: dto.title,
            sessionId: interviewId, // Link to interview
          },
          tx,
        );

        if (!studentCalendarSlot) {
          throw new TimeConflictException('The student already has a scheduling conflict');
        }

        this.logger.debug(`Student calendar slot created: ${studentCalendarSlot.id}`);

        // Create interview record in domain layer (status: scheduled)
        const interview = await this.domainService.createInterview({
          id: interviewId,
          sessionType: 'mock_interview',
          studentUserId: dto.studentId,
          createdByCounselorId: dto.createdByCounselorId,
          title: dto.title,
          scheduledAt: new Date(scheduledAtIso),
          scheduleDuration: durationMinutes,
          interviewType: dto.interviewType,
          language: dto.language,
          companyName: dto.companyName,
          jobTitle: dto.jobTitle,
          jobDescription: dto.jobDescription,
          resumeText: dto.resumeText,
          interviewInstructions: dto.interviewInstructions,
          systemInstruction: dto.systemInstruction,
        }, tx);

        return {
          interviewId: interview.getId(),
          status: interview.getStatus(),
          scheduledAt: interview.getScheduledAt(),
          studentCalendarSlotId: studentCalendarSlot.id,
        };
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Mock interview created successfully in ${duration}ms`);
      addSpanEvent('interview.creation.success');

      // Publish event for notifications
      await this.eventPublisher.publish(
        new MockInterviewCreatedEvent({
          sessionId: interviewResult.interviewId,
          studentId: dto.studentId,
          createdByCounselorId: dto.createdByCounselorId,
          scheduledAt: scheduledAtIso,
          scheduleDuration: dto.duration || 60,
          title: dto.title,
          interviewType: dto.interviewType,
          studentCalendarSlotId: interviewResult.studentCalendarSlotId,
        }),
        MockInterviewService.name,
      );

      this.logger.log(`Published MOCK_INTERVIEW_CREATED_EVENT for interview ${interviewResult.interviewId}`);

      return {
        sessionId: interviewResult.interviewId,
        status: interviewResult.status,
        scheduledAt: interviewResult.scheduledAt,
      };
    } catch (error) {
      this.logger.error(`Failed to create mock interview: ${error.message}`, error.stack);
      addSpanEvent('interview.creation.error');
      throw error;
    }
  }

  /**
   * Update mock interview
   * Handles two scenarios:
   * 1. Time/duration change: Delete old calendar slot, create new one, emit update event
   * 2. Metadata only: Update calendar title/interview details
   */
  @Trace({
    name: 'mock_interview.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateInterview(interviewId: string, dto: UpdateMockInterviewDto) {
    this.logger.log(`Updating mock interview: interviewId=${interviewId}`);
    addSpanAttributes({
      'interview.id': interviewId,
      'update.fields': Object.keys(dto).join(','),
    });

    try {
      // Step 1: Fetch old interview data for comparison
      const oldInterview = await this.queryService.getInterviewById(interviewId);
      if (!oldInterview) {
        throw new NotFoundException(`Interview ${interviewId} not found`);
      }
      
      // Step 2: Convert Date to ISO string if provided
      const scheduledAtIso = dto.scheduledAt 
        ? (dto.scheduledAt instanceof Date 
            ? dto.scheduledAt.toISOString() 
            : dto.scheduledAt)
        : undefined;

      // Step 3: Determine if time/duration changed
      const timeChanged = scheduledAtIso && scheduledAtIso !== oldInterview.scheduledAt;
      const newDuration = dto.duration ?? oldInterview.scheduleDuration;
      const durationChanged = newDuration !== oldInterview.scheduleDuration;

      // Step 4: Execute transaction to update calendar and interview
      const updatedInterview = await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Update calendar if either scheduled time or duration changed
        if (timeChanged || durationChanged) {
          // Cancel old calendar slot
          await this.calendarService.updateSlots(
            interviewId,
            { status: 'cancelled' as any },
            tx,
          );
          this.logger.debug(`Old calendar slot cancelled for interview ${interviewId}`);

          // Create new calendar slot with new time and duration
          const studentSlot = await this.calendarService.createSlotDirect(
            {
              userId: oldInterview.studentUserId,
              userType: UserType.STUDENT,
              startTime: scheduledAtIso,
              durationMinutes: newDuration,
              sessionType: CalendarSessionType.MOCK_INTERVIEW,
              title: dto.title || oldInterview.title,
              sessionId: interviewId,
            },
            tx,
          );

          if (!studentSlot) {
            throw new TimeConflictException('The student already has a scheduling conflict');
          }

          this.logger.debug(`New calendar slot created for interview ${interviewId}`);
        } else {
          // Only metadata changed, update calendar title if provided
          if (dto.title) {
            await this.calendarService.updateSlots(
              interviewId,
              { title: dto.title },
              tx,
            );
            this.logger.debug(`Calendar slot title updated for interview ${interviewId}`);
          }
        }

        // Update interview record
        const updated = await this.domainService.updateInterview(
          interviewId,
          {
            title: dto.title,
            scheduledAt: scheduledAtIso ? new Date(scheduledAtIso) : undefined,
            scheduleDuration: dto.duration,
            interviewType: dto.interviewType,
            language: dto.language,
            companyName: dto.companyName,
            jobTitle: dto.jobTitle,
            jobDescription: dto.jobDescription,
            resumeText: dto.resumeText,
            interviewInstructions: dto.interviewInstructions,
            systemInstruction: dto.systemInstruction,
          },
          tx,
        );

        return updated;
      });

      this.logger.log(`Mock interview updated: interviewId=${interviewId}`);
      addSpanEvent('interview.update.success');

      // Emit event to trigger notifications (only when time or duration changes)
      if (timeChanged || durationChanged) {
        await this.eventPublisher.publish(
          new MockInterviewUpdatedEvent({
            sessionId: interviewId,
            oldScheduledAt: oldInterview.scheduledAt,
            newScheduledAt: scheduledAtIso,
            oldDuration: oldInterview.scheduleDuration,
            newDuration: newDuration,
            newTitle: dto.title || oldInterview.title,
            studentId: oldInterview.studentUserId,
            createdByCounselorId: oldInterview.createdByCounselorId,
          }),
          MockInterviewService.name,
        );
        this.logger.log(`Published MOCK_INTERVIEW_UPDATED_EVENT for interview ${interviewId}`);
      }

      return updatedInterview;
    } catch (error) {
      this.logger.error(`Failed to update mock interview: ${error.message}`, error.stack);
      addSpanEvent('interview.update.error');
      throw error;
    }
  }

  /**
   * Cancel mock interview
   * Synchronous flow (transaction): Update interview + Release calendar slot
   *
   * @param interviewId Interview ID
   * @param reason Cancellation reason
   * @returns Cancelled interview with CANCELLED status
   */
  @Trace({
    name: 'mock_interview.cancel',
    attributes: { 'operation.type': 'cancel' },
  })
  async cancelInterview(interviewId: string, reason?: string) {
    this.logger.log(`Canceling mock interview: interviewId=${interviewId}, reason=${reason}`);
    addSpanAttributes({
      'interview.id': interviewId,
      'cancellation.reason': reason || 'not_specified',
    });

    try {
      // Step 1: Fetch interview details before cancellation
      const interview = await this.queryService.getInterviewById(interviewId);
      if (!interview) {
        throw new NotFoundException(`Interview ${interviewId} not found`);
      }

      // Step 2: Validate interview status (only scheduled can be cancelled)
      if (interview.status !== 'scheduled') {
        throw new Error(`Cannot cancel interview with status: ${interview.status}`);
      }

      // Step 3: Execute transaction to update interview and calendar
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Update interview status to CANCELLED
        await this.domainService.cancelInterview(interviewId, tx);

        // Release calendar slot
        await this.calendarService.updateSlots(
          interviewId,
          { status: 'cancelled' as any },
          tx,
        );
        this.logger.debug(`Calendar slot cancelled for interview ${interviewId}`);
      });

      // Step 4: Re-fetch interview to get updated data with cancelledAt
      const cancelledInterview = await this.queryService.getInterviewById(interviewId);

      this.logger.log(`Mock interview cancelled in transaction: interviewId=${interviewId}`);
      addSpanEvent('interview.cancel.transaction.success');

      // Step 5: Publish cancellation event for notifications
      await this.eventPublisher.publish(
        new MockInterviewCancelledEvent({
          sessionId: interviewId,
          studentId: interview.studentUserId,
          createdByCounselorId: interview.createdByCounselorId,
          scheduledAt: interview.scheduledAt,
          cancelReason: reason,
          cancelledAt: cancelledInterview.cancelledAt,
        }),
        MockInterviewService.name,
      );

      this.logger.log(`Published MOCK_INTERVIEW_CANCELLED_EVENT for interview ${interviewId}`);
      addSpanEvent('interview.cancel.success');

      return cancelledInterview;
    } catch (error) {
      this.logger.error(`Failed to cancel mock interview: ${error.message}`, error.stack);
      addSpanEvent('interview.cancel.error');
      throw error;
    }
  }

  /**
   * Soft delete mock interview
   */
  @Trace({
    name: 'mock_interview.delete',
    attributes: { 'operation.type': 'delete' },
  })
  async deleteInterview(interviewId: string) {
    this.logger.log(`Soft deleting mock interview: interviewId=${interviewId}`);
    addSpanAttributes({ 'interview.id': interviewId });

    try {
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        await this.domainService.deleteInterview(interviewId, tx);

        // Note: Calendar slots are not deleted, just marked as part of deleted interview
      });

      this.logger.log(`Mock interview deleted: interviewId=${interviewId}`);
      addSpanEvent('interview.delete.success');
      return { sessionId: interviewId, status: 'deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete mock interview: ${error.message}`, error.stack);
      addSpanEvent('interview.delete.error');
      throw error;
    }
  }

  /**
   * Get interview details
   */
  async getInterviewById(interviewId: string) {
    this.logger.debug(`Fetching mock interview details: interviewId=${interviewId}`);
    return this.queryService.getInterviewById(interviewId);
  }

  /**
   * Get interviews by student
   */
  async getInterviewsByStudent(studentId: string, filters?: any, limit?: number, offset?: number) {
    this.logger.debug(`Fetching mock interviews for student: studentId=${studentId}`);
    return this.queryService.getStudentInterviews(studentId, filters, limit, offset);
  }
}
