import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { commSessions } from '@infrastructure/database/schema';
import { CommSessionEntity, CommSessionStatus } from '../entities/comm-session.entity';
import { CommSessionNotFoundException } from '../exceptions/comm-session-not-found.exception';

/**
 * Comm Session Repository
 *
 * Handles database operations for comm_sessions table
 */
@Injectable()
export class CommSessionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  /**
   * Create a new comm session record
   */
  async create(entity: CommSessionEntity): Promise<CommSessionEntity> {
    const [result] = await this.db
      .insert(commSessions)
      .values({
        id: entity.id,
        meetingId: entity.meetingId,
        sessionType: entity.sessionType,
        studentUserId: entity.studentUserId,
        mentorUserId: entity.mentorUserId || null,
        counselorUserId: entity.counselorUserId || null,
        createdByCounselorId: entity.createdByCounselorId,
        title: entity.title,
        description: entity.description || null,
        status: entity.status,
        scheduledAt: entity.scheduledAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      } as any)
      .returning();

    return this.mapToEntity(result);
  }

  /**
   * Find comm session by ID
   */
  async findById(id: string): Promise<CommSessionEntity | null> {
    const result = await this.db.query.commSessions.findFirst({
      where: eq(commSessions.id, id as any),
    });

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * Find comm session by ID or throw exception
   */
  async findByIdOrThrow(id: string): Promise<CommSessionEntity> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new CommSessionNotFoundException(id);
    }
    return entity;
  }

  /**
   * Find comm session by meeting ID
   */
  async findByMeetingId(meetingId: string): Promise<CommSessionEntity | null> {
    const result = await this.db.query.commSessions.findFirst({
      where: eq(commSessions.meetingId, meetingId as any),
    });

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * Find sessions by mentor ID
   */
  async findByMentor(
    mentorId: string,
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<CommSessionEntity[]> {
    const whereConditions: any[] = [eq(commSessions.mentorUserId, mentorId as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(commSessions.status, CommSessionStatus.DELETED));
    }

    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    const results = await this.db.query.commSessions.findMany({
      where: and(...whereConditions),
      limit,
      offset,
      orderBy: desc(commSessions.scheduledAt),
    });

    return results.map((row) => this.mapToEntity(row));
  }

  /**
   * Find sessions by student ID
   */
  async findByStudent(
    studentId: string,
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<CommSessionEntity[]> {
    const whereConditions: any[] = [eq(commSessions.studentUserId, studentId as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(commSessions.status, CommSessionStatus.DELETED));
    }

    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    const results = await this.db.query.commSessions.findMany({
      where: and(...whereConditions),
      limit,
      offset,
      orderBy: desc(commSessions.scheduledAt),
    });

    return results.map((row) => this.mapToEntity(row));
  }

  /**
   * Update comm session record
   */
  async update(id: string, entity: Partial<CommSessionEntity>): Promise<CommSessionEntity> {
    const updates: any = { updatedAt: new Date() };

    if (entity.title !== undefined) updates.title = entity.title;
    if (entity.description !== undefined) updates.description = entity.description;
    if (entity.scheduledAt !== undefined) updates.scheduledAt = entity.scheduledAt;
    if (entity.status !== undefined) updates.status = entity.status;
    if (entity.completedAt !== undefined) updates.completedAt = entity.completedAt;
    if (entity.cancelledAt !== undefined) updates.cancelledAt = entity.cancelledAt;
    if (entity.deletedAt !== undefined) updates.deletedAt = entity.deletedAt;

    const [result] = await this.db
      .update(commSessions)
      .set(updates)
      .where(eq(commSessions.id, id as any))
      .returning();

    return this.mapToEntity(result);
  }

  /**
   * Map database row to entity
   */
  private mapToEntity(row: any): CommSessionEntity {
    return new CommSessionEntity({
      id: row.id,
      meetingId: row.meeting_id,
      sessionType: row.session_type,
      studentUserId: row.student_user_id,
      mentorUserId: row.mentor_user_id,
      counselorUserId: row.counselor_user_id,
      createdByCounselorId: row.created_by_counselor_id,
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

