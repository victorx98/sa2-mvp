import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, ne, count, like } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classes, classMentorsPrices, classStudents, classCounselors } from '@infrastructure/database/schema';
import { ClassEntity, ClassStatus, ClassType } from '../entities/class.entity';
import { ClassMentorPriceEntity } from '../entities/class-mentor-price.entity';
import { ClassStudentEntity } from '../entities/class-student.entity';
import { ClassCounselorEntity } from '../entities/class-counselor.entity';
import { ClassNotFoundException } from '../../shared/exceptions/class-not-found.exception';

@Injectable()
export class ClassRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  async create(entity: ClassEntity): Promise<ClassEntity> {
    const [result] = await this.db
      .insert(classes)
      .values({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        status: entity.status,
        startDate: entity.startDate,
        endDate: entity.endDate,
        description: entity.description,
        totalSessions: entity.totalSessions,
        createdByCounselorId: entity.createdByCounselorId,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      } as any)
      .returning();

    return this.mapToEntity(result);
  }

  async findById(id: string): Promise<ClassEntity | null> {
    const result = await this.db.query.classes.findFirst({
      where: eq(classes.id, id as any),
    });

    return result ? this.mapToEntity(result) : null;
  }

  async findByIdOrThrow(id: string): Promise<ClassEntity> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new ClassNotFoundException(id);
    }
    return entity;
  }

  async findAll(
    limit: number = 10,
    offset: number = 0,
    filters?: {
      status?: ClassStatus;
      type?: ClassType;
      createdByCounselorId?: string;
      name?: string;
    },
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<ClassEntity[]> {
    const whereConditions: any[] = [];

    if (filters?.status) {
      whereConditions.push(eq(classes.status, filters.status));
    }

    if (filters?.type) {
      whereConditions.push(eq(classes.type, filters.type));
    }

    if (filters?.createdByCounselorId) {
      whereConditions.push(eq(classes.createdByCounselorId, filters.createdByCounselorId as any));
    }

    // Fuzzy search by name using LIKE
    if (filters?.name) {
      whereConditions.push(like(classes.name, `%${filters.name}%`));
    }

    // Determine sort column
    const sortColumn = sortBy === 'startDate' ? classes.startDate : classes.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const results = await this.db.query.classes.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      limit,
      offset,
      orderBy: orderByClause,
    });

    return results.map((row) => this.mapToEntity(row));
  }

  async count(filters?: {
    status?: ClassStatus;
    type?: ClassType;
    createdByCounselorId?: string;
    name?: string;
  }): Promise<number> {
    const whereConditions: any[] = [];

    if (filters?.status) {
      whereConditions.push(eq(classes.status, filters.status));
    }

    if (filters?.type) {
      whereConditions.push(eq(classes.type, filters.type));
    }

    if (filters?.createdByCounselorId) {
      whereConditions.push(eq(classes.createdByCounselorId, filters.createdByCounselorId as any));
    }

    // Fuzzy search by name using LIKE
    if (filters?.name) {
      whereConditions.push(like(classes.name, `%${filters.name}%`));
    }

    const result = await this.db
      .select({ count: count() })
      .from(classes)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return result[0]?.count || 0;
  }

  async update(id: string, entity: Partial<ClassEntity>): Promise<ClassEntity> {
    const updates: any = { updatedAt: new Date() };

    if (entity.name !== undefined) updates.name = entity.name;
    if (entity.startDate !== undefined) updates.startDate = entity.startDate;
    if (entity.endDate !== undefined) updates.endDate = entity.endDate;
    if (entity.description !== undefined) updates.description = entity.description;
    if (entity.totalSessions !== undefined) updates.totalSessions = entity.totalSessions;
    if (entity.status !== undefined) updates.status = entity.status;

    const [result] = await this.db
      .update(classes)
      .set(updates)
      .where(eq(classes.id, id as any))
      .returning();

    return this.mapToEntity(result);
  }

  async addMentor(classId: string, mentorId: string, pricePerSession: number): Promise<ClassMentorPriceEntity> {
    const [result] = await this.db
      .insert(classMentorsPrices)
      .values({
        classId: classId,
        mentorUserId: mentorId,
        pricePerSession: pricePerSession,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return this.mapMentorToEntity(result);
  }

  async removeMentor(classId: string, mentorId: string): Promise<void> {
    await this.db
      .delete(classMentorsPrices)
      .where(
        and(
          eq(classMentorsPrices.classId, classId as any),
          eq(classMentorsPrices.mentorUserId, mentorId as any),
        ),
      );
  }

  async updateMentorPrice(classId: string, mentorId: string, pricePerSession: number): Promise<void> {
    await this.db
      .update(classMentorsPrices)
      .set({
        pricePerSession: pricePerSession,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(classMentorsPrices.classId, classId as any),
          eq(classMentorsPrices.mentorUserId, mentorId as any),
        ),
      );
  }

  async getMentors(classId: string): Promise<ClassMentorPriceEntity[]> {
    const results = await this.db.query.classMentorsPrices.findMany({
      where: eq(classMentorsPrices.classId, classId as any),
      orderBy: asc(classMentorsPrices.createdAt),
    });

    return results.map((row) => this.mapMentorToEntity(row));
  }

  async addStudent(classId: string, studentId: string): Promise<ClassStudentEntity> {
    const [result] = await this.db
      .insert(classStudents)
      .values({
        classId: classId,
        studentUserId: studentId,
        enrolledAt: new Date(),
        createdAt: new Date(),
      } as any)
      .returning();

    return this.mapStudentToEntity(result);
  }

  async removeStudent(classId: string, studentId: string): Promise<void> {
    await this.db
      .delete(classStudents)
      .where(
        and(eq(classStudents.classId, classId as any), eq(classStudents.studentUserId, studentId as any)),
      );
  }

  async getStudents(classId: string): Promise<ClassStudentEntity[]> {
    const results = await this.db.query.classStudents.findMany({
      where: eq(classStudents.classId, classId as any),
      orderBy: asc(classStudents.enrolledAt),
    });

    return results.map((row) => this.mapStudentToEntity(row));
  }

  async addCounselor(classId: string, counselorId: string): Promise<ClassCounselorEntity> {
    const [result] = await this.db
      .insert(classCounselors)
      .values({
        classId: classId,
        counselorUserId: counselorId,
        createdAt: new Date(),
      } as any)
      .returning();

    return this.mapCounselorToEntity(result);
  }

  async removeCounselor(classId: string, counselorId: string): Promise<void> {
    await this.db
      .delete(classCounselors)
      .where(
        and(eq(classCounselors.classId, classId as any), eq(classCounselors.counselorUserId, counselorId as any)),
      );
  }

  async getCounselors(classId: string): Promise<ClassCounselorEntity[]> {
    const results = await this.db.query.classCounselors.findMany({
      where: eq(classCounselors.classId, classId as any),
      orderBy: asc(classCounselors.createdAt),
    });

    return results.map((row) => this.mapCounselorToEntity(row));
  }

  async hasMentor(classId: string, mentorId: string): Promise<boolean> {
    const result = await this.db.query.classMentorsPrices.findFirst({
      where: and(
        eq(classMentorsPrices.classId, classId as any),
        eq(classMentorsPrices.mentorUserId, mentorId as any),
      ),
    });

    return !!result;
  }

  async hasStudent(classId: string, studentId: string): Promise<boolean> {
    const result = await this.db.query.classStudents.findFirst({
      where: and(
        eq(classStudents.classId, classId as any),
        eq(classStudents.studentUserId, studentId as any),
      ),
    });

    return !!result;
  }

  async hasCounselor(classId: string, counselorId: string): Promise<boolean> {
    const result = await this.db.query.classCounselors.findFirst({
      where: and(
        eq(classCounselors.classId, classId as any),
        eq(classCounselors.counselorUserId, counselorId as any),
      ),
    });

    return !!result;
  }

  private mapToEntity(row: any): ClassEntity {
    return new ClassEntity({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      startDate: row.startDate || row.start_date,
      endDate: row.endDate || row.end_date,
      description: row.description,
      totalSessions: row.totalSessions || row.total_sessions,
      createdByCounselorId: row.createdByCounselorId || row.created_by_counselor_id,
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
    });
  }

  private mapMentorToEntity(row: any): ClassMentorPriceEntity {
    return new ClassMentorPriceEntity({
      id: row.id,
      classId: row.class_id,
      mentorUserId: row.mentor_user_id,
      pricePerSession: parseInt(row.price_per_session, 10),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapStudentToEntity(row: any): ClassStudentEntity {
    return new ClassStudentEntity({
      id: row.id,
      classId: row.class_id,
      studentUserId: row.student_user_id,
      enrolledAt: row.enrolled_at,
      createdAt: row.created_at,
    });
  }

  private mapCounselorToEntity(row: any): ClassCounselorEntity {
    return new ClassCounselorEntity({
      id: row.id,
      classId: row.class_id,
      counselorUserId: row.counselor_user_id,
      createdAt: row.created_at,
    });
  }
}
