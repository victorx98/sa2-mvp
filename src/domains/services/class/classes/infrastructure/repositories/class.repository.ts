import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, ne, count, like } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classes, classMentorsPrices, classStudents, classCounselors } from '@infrastructure/database/schema';
import { ClassEntity } from '../../entities/class.entity';
import { ClassStatus } from '../../value-objects/class-status.vo';
import { ClassType } from '../../value-objects/class-type.vo';
import { IClassRepository } from '../../repositories/class.repository.interface';
import { ClassMapper } from '../mappers/class.mapper';
import { ClassNotFoundException } from '../../exceptions/exceptions';

/**
 * Infrastructure Layer - Class Repository Implementation
 * Implements data access using Drizzle ORM
 */
@Injectable()
export class ClassRepository implements IClassRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {}

  async create(entity: ClassEntity): Promise<ClassEntity> {
    const data = ClassMapper.toPersistence(entity);

    const [result] = await this.db
      .insert(classes)
      .values({
        id: data.id,
        name: data.name,
        type: data.type,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description,
        totalSessions: data.totalSessions,
        createdByCounselorId: data.createdByCounselorId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as any)
      .returning();

    return ClassMapper.toDomain(result);
  }

  async findById(id: string): Promise<ClassEntity | null> {
    const result = await this.db.query.classes.findFirst({
      where: eq(classes.id, id as any),
    });

    return result ? ClassMapper.toDomain(result) : null;
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

    if (filters?.name) {
      whereConditions.push(like(classes.name, `%${filters.name}%`));
    }

    const sortColumn = sortBy === 'startDate' ? classes.startDate : classes.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const results = await this.db.query.classes.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      limit,
      offset,
      orderBy: orderByClause,
    });

    return results.map((row) => ClassMapper.toDomain(row));
  }

  async count(filters?: {
    status?: ClassStatus;
    type?: ClassType;
    createdByCounselorId?: string;
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

    const [result] = await this.db
      .select({ count: count() })
      .from(classes)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return Number(result.count);
  }

  async update(id: string, updates: Partial<ClassEntity>): Promise<ClassEntity> {
    const updateData: any = { updatedAt: new Date() };

    if (updates.getName) updateData.name = updates.getName();
    if (updates.getStartDate) updateData.startDate = updates.getStartDate();
    if (updates.getEndDate) updateData.endDate = updates.getEndDate();
    if (updates.getDescription !== undefined) updateData.description = updates.getDescription();
    if (updates.getTotalSessions) updateData.totalSessions = updates.getTotalSessions();
    if (updates.getStatus) updateData.status = updates.getStatus();

    const [result] = await this.db
      .update(classes)
      .set(updateData)
      .where(eq(classes.id, id as any))
      .returning();

    return ClassMapper.toDomain(result);
  }

  async save(entity: ClassEntity): Promise<ClassEntity> {
    const data = ClassMapper.toPersistence(entity);

    const [result] = await this.db
      .update(classes)
      .set({
        name: data.name,
        type: data.type,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description,
        totalSessions: data.totalSessions,
        createdByCounselorId: data.createdByCounselorId,
        updatedAt: data.updatedAt,
      } as any)
      .where(eq(classes.id, data.id as any))
      .returning();

    return ClassMapper.toDomain(result);
  }

  // Mentor operations
  async hasMentor(classId: string, mentorId: string): Promise<boolean> {
    const result = await this.db.query.classMentorsPrices.findFirst({
      where: and(
        eq(classMentorsPrices.classId, classId as any),
        eq(classMentorsPrices.mentorUserId, mentorId as any),
      ),
    });
    return !!result;
  }

  async addMentor(classId: string, mentorId: string, pricePerSession: number): Promise<void> {
    await this.db.insert(classMentorsPrices).values({
      classId: classId as any,
      mentorUserId: mentorId as any,
      pricePerSession,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
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

  async getMentors(classId: string): Promise<any[]> {
    return this.db.query.classMentorsPrices.findMany({
      where: eq(classMentorsPrices.classId, classId as any),
    });
  }

  // Student operations
  async hasStudent(classId: string, studentId: string): Promise<boolean> {
    const result = await this.db.query.classStudents.findFirst({
      where: and(
        eq(classStudents.classId, classId as any),
        eq(classStudents.studentUserId, studentId as any),
      ),
    });
    return !!result;
  }

  async addStudent(classId: string, studentId: string): Promise<void> {
    await this.db.insert(classStudents).values({
      classId: classId as any,
      studentUserId: studentId as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async removeStudent(classId: string, studentId: string): Promise<void> {
    await this.db
      .delete(classStudents)
      .where(
        and(
          eq(classStudents.classId, classId as any),
          eq(classStudents.studentUserId, studentId as any),
        ),
      );
  }

  async getStudents(classId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    return this.db.query.classStudents.findMany({
      where: eq(classStudents.classId, classId as any),
      limit,
      offset,
    });
  }

  async countStudents(classId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(classStudents)
      .where(eq(classStudents.classId, classId as any));

    return Number(result.count);
  }

  // Counselor operations
  async hasCounselor(classId: string, counselorId: string): Promise<boolean> {
    const result = await this.db.query.classCounselors.findFirst({
      where: and(
        eq(classCounselors.classId, classId as any),
        eq(classCounselors.counselorUserId, counselorId as any),
      ),
    });
    return !!result;
  }

  async addCounselor(classId: string, counselorId: string): Promise<void> {
    await this.db.insert(classCounselors).values({
      classId: classId as any,
      counselorUserId: counselorId as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  async removeCounselor(classId: string, counselorId: string): Promise<void> {
    await this.db
      .delete(classCounselors)
      .where(
        and(
          eq(classCounselors.classId, classId as any),
          eq(classCounselors.counselorUserId, counselorId as any),
        ),
      );
  }

  async getCounselors(classId: string): Promise<any[]> {
    return this.db.query.classCounselors.findMany({
      where: eq(classCounselors.classId, classId as any),
    });
  }
}

