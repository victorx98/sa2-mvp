import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, ne, inArray } from 'drizzle-orm';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { commSessions, meetings } from '@infrastructure/database/schema';
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

    return this.mapToEntity(result); // Wrap in Entity class to get methods
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

    return results.map(row => this.mapToEntity(row));
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

    return results.map(row => this.mapToEntity(row));
  }

  /**
   * Find sessions by multiple student IDs with meeting details
   * Used to retrieve all sessions for a counselor's students
   */
  async findByStudentIds(
    studentIds: string[],
    filters?: {
      status?: CommSessionStatus;
      excludeDeleted?: boolean;
    },
  ): Promise<any[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const whereConditions: any[] = [inArray(commSessions.studentUserId, studentIds as any)];

    if (filters?.excludeDeleted ?? true) {
      whereConditions.push(ne(commSessions.status, CommSessionStatus.DELETED));
    }

    if (filters?.status) {
      whereConditions.push(eq(commSessions.status, filters.status));
    }

    // Manual LEFT JOIN with meetings table to include meeting details
    const results = await this.db
      .select({
        session: commSessions,
        meeting: meetings,
      })
      .from(commSessions)
      .leftJoin(meetings, eq(commSessions.meetingId, meetings.id))
      .where(and(...whereConditions))
      .orderBy(desc(commSessions.scheduledAt));

    // Map results to include meeting data
    return results.map(row => ({
      ...this.mapToEntity(row.session),
      meeting: row.meeting || undefined,
    })) as any;
  }

  /**
   * Update comm session record
   * @param id - Session ID
   * @param entity - Partial entity with fields to update
   * @param tx - Optional transaction for atomicity
   */
  async update(
    id: string,
    entity: Partial<CommSessionEntity>,
    tx?: DrizzleTransaction,
  ): Promise<CommSessionEntity> {
    const updates: any = { updatedAt: new Date() };

    if (entity.title !== undefined) updates.title = entity.title;
    if (entity.description !== undefined) updates.description = entity.description;
    if (entity.scheduledAt !== undefined) updates.scheduledAt = entity.scheduledAt;
    if (entity.status !== undefined) updates.status = entity.status;
    if (entity.completedAt !== undefined) updates.completedAt = entity.completedAt;
    if (entity.cancelledAt !== undefined) updates.cancelledAt = entity.cancelledAt;
    if (entity.deletedAt !== undefined) updates.deletedAt = entity.deletedAt;
    if (entity.meetingId !== undefined) updates.meetingId = entity.meetingId; // Fix: use camelCase

    const db = tx || this.db;
    const [result] = await db
      .update(commSessions)
      .set(updates)
      .where(eq(commSessions.id, id as any))
      .returning();

    return this.mapToEntity(result); // Wrap in Entity class to get methods
  }

  /**
   * Map database row to CommSessionEntity instance
   * Drizzle handles date conversion automatically for both query() and returning()
   */
  private mapToEntity(row: any): CommSessionEntity {
    return new CommSessionEntity(row);
  }
}

