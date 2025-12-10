import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classSessions } from '@infrastructure/database/schema';
import { ClassSessionEntity, ClassSessionStatus } from '../entities/class-session.entity';
import { ClassSessionNotFoundException } from '../../shared/exceptions/class-session-not-found.exception';

@Injectable()
export class ClassSessionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  async create(entity: ClassSessionEntity): Promise<ClassSessionEntity> {
    const [result] = await this.db
      .insert(classSessions)
      .values({
        id: entity.id,
        classId: entity.classId,
        meetingId: entity.meetingId,
        sessionType: entity.sessionType,
        mentorUserId: entity.mentorUserId,
        title: entity.title,
        description: entity.description,
        status: entity.status,
        scheduledAt: entity.scheduledAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      } as any)
      .returning();

    return this.mapToEntity(result);
  }

  async findById(id: string): Promise<ClassSessionEntity | null> {
    const result = await this.db.query.classSessions.findFirst({
      where: eq(classSessions.id, id as any),
    });

    return result ? this.mapToEntity(result) : null;
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

    return result ? this.mapToEntity(result) : null;
  }

  async findByClass(
    classId: string,
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: ClassSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<ClassSessionEntity[]> {
    const whereConditions: any[] = [eq(classSessions.classId, classId as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(classSessions.status, ClassSessionStatus.DELETED));
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

    return results.map((row) => this.mapToEntity(row));
  }

  async findByMentor(
    mentorId: string,
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: ClassSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<ClassSessionEntity[]> {
    const whereConditions: any[] = [eq(classSessions.mentorUserId, mentorId as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(classSessions.status, ClassSessionStatus.DELETED));
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

    return results.map((row) => this.mapToEntity(row));
  }

  async update(
    id: string,
    entity: Partial<ClassSessionEntity>,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    const updates: any = { updatedAt: new Date() };

    if (entity.title !== undefined) updates.title = entity.title;
    if (entity.description !== undefined) updates.description = entity.description;
    if (entity.scheduledAt !== undefined) updates.scheduledAt = entity.scheduledAt;
    if (entity.mentorUserId !== undefined) updates.mentorUserId = entity.mentorUserId;
    if (entity.status !== undefined) updates.status = entity.status;
    if (entity.completedAt !== undefined) updates.completedAt = entity.completedAt;
    if (entity.cancelledAt !== undefined) updates.cancelledAt = entity.cancelledAt;
    if (entity.deletedAt !== undefined) updates.deletedAt = entity.deletedAt;
    if (entity.meetingId !== undefined) updates.meeting_id = entity.meetingId;

    const db = tx || this.db;
    const [result] = await db
      .update(classSessions)
      .set(updates)
      .where(eq(classSessions.id, id as any))
      .returning();

    return this.mapToEntity(result);
  }

  private mapToEntity(row: any): ClassSessionEntity {
    return new ClassSessionEntity({
      id: row.id,
      classId: row.class_id,
      meetingId: row.meeting_id,
      sessionType: row.session_type,
      mentorUserId: row.mentor_user_id,
      title: row.title,
      description: row.description,
      status: row.status,
      scheduledAt: row.scheduled_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      deletedAt: row.deleted_at,
      aiSummaries: row.ai_summaries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
