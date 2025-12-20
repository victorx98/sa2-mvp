import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classSessions } from '@infrastructure/database/schema';
import { ClassSessionEntity } from '../../entities/class-session.entity';
import { SessionStatus } from '../../value-objects/session-status.vo';
import { IClassSessionRepository } from '../../repositories/class-session.repository.interface';
import { ClassSessionMapper } from '../mappers/class-session.mapper';
import { ClassSessionNotFoundException } from '../../exceptions/exceptions';

/**
 * Infrastructure Layer - Class Session Repository Implementation
 * Implements data access using Drizzle ORM
 */
@Injectable()
export class ClassSessionRepository implements IClassSessionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  async create(entity: ClassSessionEntity, tx?: DrizzleTransaction): Promise<ClassSessionEntity> {
    const data = ClassSessionMapper.toPersistence(entity);
    const db = tx || this.db;

    const [result] = await db
      .insert(classSessions)
      .values({
        id: data.id,
        classId: data.classId,
        meetingId: data.meetingId,
        sessionType: data.sessionType,
        mentorUserId: data.mentorUserId,
        createdByCounselorId: data.createdByCounselorId,
        title: data.title,
        description: data.description,
        status: data.status,
        scheduledAt: data.scheduledAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as any)
      .returning();

    return ClassSessionMapper.toDomain(result);
  }

  async findById(id: string): Promise<ClassSessionEntity | null> {
    const result = await this.db.query.classSessions.findFirst({
      where: eq(classSessions.id, id as any),
    });

    return result ? ClassSessionMapper.toDomain(result) : null;
  }

  async findByIdOrThrow(id: string): Promise<ClassSessionEntity> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new ClassSessionNotFoundException(id);
    }
    return entity;
  }

  async findByMeetingId(meetingId: string): Promise<ClassSessionEntity | null> {
    const result = await this.db.query.classSessions.findFirst({
      where: eq(classSessions.meetingId, meetingId as any),
    });

    return result ? ClassSessionMapper.toDomain(result) : null;
  }

  async findByClass(
    classId: string,
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: SessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<ClassSessionEntity[]> {
    const whereConditions: any[] = [eq(classSessions.classId, classId as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(classSessions.status, SessionStatus.DELETED));
    }

    if (filters?.status) {
      whereConditions.push(eq(classSessions.status, filters.status));
    }

    const results = await this.db.query.classSessions.findMany({
      where: and(...whereConditions),
      limit,
      offset,
      orderBy: desc(classSessions.scheduledAt),
    });

    return results.map((row) => ClassSessionMapper.toDomain(row));
  }

  async findByMentor(
    mentorId: string,
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: SessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<ClassSessionEntity[]> {
    const whereConditions: any[] = [eq(classSessions.mentorUserId, mentorId as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(classSessions.status, SessionStatus.DELETED));
    }

    if (filters?.status) {
      whereConditions.push(eq(classSessions.status, filters.status));
    }

    const results = await this.db.query.classSessions.findMany({
      where: and(...whereConditions),
      limit,
      offset,
      orderBy: desc(classSessions.scheduledAt),
    });

    return results.map((row) => ClassSessionMapper.toDomain(row));
  }

  async update(
    id: string,
    updates: Partial<ClassSessionEntity>,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    const db = tx || this.db;
    const updateData: any = { updatedAt: new Date() };

    // Map entity properties to database columns
    if (updates.getTitle) updateData.title = updates.getTitle();
    if (updates.getDescription) updateData.description = updates.getDescription();
    if (updates.getScheduledAt) updateData.scheduledAt = updates.getScheduledAt();
    if (updates.getMentorUserId) updateData.mentorUserId = updates.getMentorUserId();
    if (updates.getStatus) updateData.status = updates.getStatus();
    if (updates.getCompletedAt) updateData.completedAt = updates.getCompletedAt();
    if (updates.getCancelledAt) updateData.cancelledAt = updates.getCancelledAt();
    if (updates.getDeletedAt) updateData.deletedAt = updates.getDeletedAt();
    if (updates.getMeetingId) updateData.meetingId = updates.getMeetingId();

    const [result] = await db
      .update(classSessions)
      .set(updateData)
      .where(eq(classSessions.id, id as any))
      .returning();

    return ClassSessionMapper.toDomain(result);
  }

  async save(entity: ClassSessionEntity, tx?: DrizzleTransaction): Promise<ClassSessionEntity> {
    const data = ClassSessionMapper.toPersistence(entity);
    const db = tx || this.db;

    const [result] = await db
      .update(classSessions)
      .set({
        classId: data.classId,
        meetingId: data.meetingId,
        sessionType: data.sessionType,
        mentorUserId: data.mentorUserId,
        createdByCounselorId: data.createdByCounselorId,
        title: data.title,
        description: data.description,
        status: data.status,
        scheduledAt: data.scheduledAt,
        completedAt: data.completedAt,
        cancelledAt: data.cancelledAt,
        deletedAt: data.deletedAt,
        aiSummaries: data.aiSummaries,
        updatedAt: data.updatedAt,
      } as any)
      .where(eq(classSessions.id, data.id as any))
      .returning();

    return ClassSessionMapper.toDomain(result);
  }
}

