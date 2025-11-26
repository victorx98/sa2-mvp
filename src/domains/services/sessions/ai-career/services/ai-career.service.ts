import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiCareerRepository } from '../ai-career.repository';
import { SessionTypesRepository } from '@domains/services/session-types/session-types.repository';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import { CreateAiCareerDto } from '../dto/create-ai-career.dto';
import { UpdateAiCareerDto } from '../dto/update-ai-career.dto';
import { AiCareerSessionEntity } from '../entities/ai-career-session.entity';
import { SessionStatus } from '../../shared/enums/session-type.enum';
import { SessionNotFoundException, SessionTypeNotFoundException } from '../../shared/exceptions/session-not-found.exception';
import { MeetingLifecycleCompletedPayload, SERVICE_SESSION_COMPLETED_EVENT } from '@shared/events';

/**
 * AI Career Service
 * 
 * Handles AI career session business logic and lifecycle
 */
@Injectable()
export class AiCareerService {
  private readonly logger = new Logger(AiCareerService.name);

  constructor(
    private readonly repository: AiCareerRepository,
    private readonly sessionTypesRepository: SessionTypesRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(dto: CreateAiCareerDto, tx?: any): Promise<AiCareerSessionEntity> {
    this.logger.log(`Creating AI career session for meeting ${dto.meetingId}`);

    const session = await this.repository.create({
      meetingId: dto.meetingId,
      sessionType: dto.sessionType,
      sessionTypeId: dto.sessionTypeId,
      studentUserId: dto.studentUserId,
      mentorUserId: dto.mentorUserId,
      createdByCounselorId: dto.createdByCounselorId || null,
      title: dto.title,
      description: dto.description || null,
      status: SessionStatus.SCHEDULED,
      scheduledAt: new Date(dto.scheduledAt),
      aiSummaries: [],
    }, tx);

    this.logger.log(`Successfully created AI career session ${session.id}`);
    return session;
  }

  async updateSession(
    id: string,
    dto: UpdateAiCareerDto,
  ): Promise<AiCareerSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }

    const updateData: Partial<AiCareerSessionEntity> = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.scheduledAt) updateData.scheduledAt = new Date(dto.scheduledAt);

    await this.repository.update(id, updateData);

    this.logger.log(`Updated AI career session ${id}`);
    return this.repository.findOne(id);
  }

  async cancelSession(id: string, reason?: string): Promise<void> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }

    await this.repository.update(id, {
      status: SessionStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    this.logger.log(`Cancelled AI career session ${id}. Reason: ${reason || 'N/A'}`);
  }

  async deleteSession(id: string): Promise<void> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }

    await this.repository.update(id, {
      status: SessionStatus.DELETED,
      deletedAt: new Date(),
    });

    this.logger.log(`Soft deleted AI career session ${id}`);
  }

  async completeSession(
    sessionId: string,
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    this.logger.log(`Completing AI career session ${sessionId}`);

    // 1. Query Session information
    const session = await this.repository.findOne(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }

    // 2. Query session_types to get business configuration
    const sessionType = await this.sessionTypesRepository.findOne(
      session.sessionTypeId,
    );
    if (!sessionType) {
      throw new SessionTypeNotFoundException(session.sessionTypeId);
    }

    // 3. Update Session status
    await this.repository.update(sessionId, {
      status: SessionStatus.COMPLETED,
      completedAt: new Date(),
    });

    // 4. Register service to Service Registry
    await this.serviceRegistryService.registerService({
      id: sessionId,
      service_type: session.sessionType,
      student_user_id: session.studentUserId,
      provider_user_id: session.mentorUserId,
      consumed_units: this.calculateUnits(payload.actualDuration),
      unit_type: 'hour',
      completed_time: payload.endedAt,
    });

    // 5. Publish services.session.completed event
    this.eventEmitter.emit(SERVICE_SESSION_COMPLETED_EVENT, {
      payload: {
        sessionId: sessionId,
        studentId: session.studentUserId,
        mentorId: session.mentorUserId,
        refrenceId: sessionId,
        sessionTypeCode: sessionType.code,
        actualDurationHours: payload.actualDuration / 3600,
        durationHours: payload.scheduleDuration / 60,
        allowBilling: sessionType.isBilling,
      },
    });

    this.logger.log(`Successfully completed AI career session ${sessionId}`);
  }

  async findByMeetingId(meetingId: string): Promise<AiCareerSessionEntity | null> {
    return this.repository.findByMeetingId(meetingId);
  }

  async getSessionById(id: string): Promise<AiCareerSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }

  private calculateUnits(durationSeconds: number): number {
    return Math.round((durationSeconds / 3600) * 100) / 100;
  }
}

