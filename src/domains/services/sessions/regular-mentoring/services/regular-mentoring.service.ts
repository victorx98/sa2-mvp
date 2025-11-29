import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RegularMentoringRepository } from '../regular-mentoring.repository';
import { SessionTypesRepository } from '@domains/services/session-types/session-types.repository';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import { CreateRegularMentoringDto } from '../dto/create-regular-mentoring.dto';
import { UpdateRegularMentoringDto } from '../dto/update-regular-mentoring.dto';
import { RegularMentoringSessionEntity } from '../entities/regular-mentoring-session.entity';
import { SessionStatus } from '../../shared/enums/session-type.enum';
import { SessionNotFoundException, SessionTypeNotFoundException } from '../../shared/exceptions/session-not-found.exception';
import { MeetingLifecycleCompletedPayload, SERVICE_SESSION_COMPLETED_EVENT } from '@shared/events';

/**
 * Regular Mentoring Service
 * 
 * Handles regular mentoring session business logic and lifecycle
 */
@Injectable()
export class RegularMentoringService {
  private readonly logger = new Logger(RegularMentoringService.name);

  constructor(
    private readonly repository: RegularMentoringRepository,
    private readonly sessionTypesRepository: SessionTypesRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(dto: CreateRegularMentoringDto, tx?: any): Promise<RegularMentoringSessionEntity> {
    this.logger.log(`Creating regular mentoring session for meeting ${dto.meetingId}`);

    const session = await this.repository.create({
      meetingId: dto.meetingId,
      sessionType: dto.sessionType,
      sessionTypeId: dto.sessionTypeId || null, // Nullable until session_types lookup is implemented
      studentUserId: dto.studentUserId,
      mentorUserId: dto.mentorUserId,
      createdByCounselorId: dto.createdByCounselorId || null,
      title: dto.title,
      description: dto.description || null,
      status: SessionStatus.SCHEDULED,
      scheduledAt: new Date(dto.scheduledAt),
      aiSummaries: [],
    }, tx);

    this.logger.log(`Successfully created regular mentoring session ${session.id}`);
    return session;
  }

  async updateSession(
    id: string,
    dto: UpdateRegularMentoringDto,
  ): Promise<RegularMentoringSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }

    const updateData: Partial<RegularMentoringSessionEntity> = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.scheduledAt) updateData.scheduledAt = new Date(dto.scheduledAt);

    await this.repository.update(id, updateData);

    this.logger.log(`Updated regular mentoring session ${id}`);
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

    this.logger.log(`Cancelled regular mentoring session ${id}. Reason: ${reason || 'N/A'}`);
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

    this.logger.log(`Soft deleted regular mentoring session ${id}`);
  }

  async completeSession(
    sessionId: string,
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    this.logger.log(`Completing regular mentoring session ${sessionId}`);

    // 1. Query Session information
    const session = await this.repository.findOne(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }

    // 2. Query session_types to get business configuration (code and is_billing)
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

    // 4. Register service to Service Registry (shared primary key)
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

    this.logger.log(`Successfully completed regular mentoring session ${sessionId}`);
  }

  async findByMeetingId(meetingId: string): Promise<RegularMentoringSessionEntity | null> {
    return this.repository.findByMeetingId(meetingId);
  }

  async getSessionById(id: string): Promise<RegularMentoringSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }

  private calculateUnits(durationMinutes: number): number {
    // actualDuration is now in minutes, convert to hours for consumed_units
    return Math.round((durationMinutes / 60) * 100) / 100;
  }
}

