import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { IClassQueryRepository } from '../../interfaces/class-query.repository.interface';
import { QueryClassesDto, GetClassMembersDto } from '../../dto/class-query.dto';
import { ClassReadModel, ClassMemberReadModel } from '../../models/class-read.model';

import { IPaginatedResult } from '@shared/types/paginated-result';
import { classMentorsPrices } from '@infrastructure/database/schema/class-mentors-prices.schema';
import { classStudents } from '@infrastructure/database/schema/class-students.schema';
import { classCounselors } from '@infrastructure/database/schema/class-counselors.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import { classes } from '@infrastructure/database/schema/classes.schema';

@Injectable()
export class DrizzleClassQueryRepository implements IClassQueryRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof import('@infrastructure/database/schema')>,
  ) {}

  async queryClasses(dto: QueryClassesDto): Promise<IPaginatedResult<ClassReadModel>> {
    const { page = 1, pageSize = 10, status, type } = dto;
    const offset = (page - 1) * pageSize;

    const filters: any[] = [];
    if (status) filters.push(eq(classes.status, status));
    if (type) filters.push(eq(classes.type, type));

    const total = await this.db.select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .then((result) => result[0]?.count || 0);

    const data = await this.db
      .select({
        id: classes.id,
        name: classes.name,
        status: classes.status,
        type: classes.type,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
      })
      .from(classes)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getClassMentorsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]> {
    const { classId } = dto;

    const result = await this.db
      .select({
        userId: classMentorsPrices.mentorUserId,
        pricePerSession: classMentorsPrices.pricePerSession,
        addedAt: classMentorsPrices.createdAt,
        nameZh: userTable.nameZh,
        nameEn: userTable.nameEn,
      })
      .from(classMentorsPrices)
      .leftJoin(userTable, eq(classMentorsPrices.mentorUserId, userTable.id))
      .where(eq(classMentorsPrices.classId, classId));

    return result.map((row) => ({
      userId: row.userId,
      name: {
        en: row.nameEn || '',
        zh: row.nameZh || '',
      },
      pricePerSession: row.pricePerSession,
      addedAt: row.addedAt,
    }));
  }

  async getClassStudentsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]> {
    const { classId } = dto;

    const result = await this.db
      .select({
        userId: classStudents.studentUserId,
        addedAt: classStudents.enrolledAt,
        nameZh: userTable.nameZh,
        nameEn: userTable.nameEn,
      })
      .from(classStudents)
      .leftJoin(userTable, eq(classStudents.studentUserId, userTable.id))
      .where(eq(classStudents.classId, classId));

    return result.map((row) => ({
      userId: row.userId,
      name: {
        en: row.nameEn || '',
        zh: row.nameZh || '',
      },
      addedAt: row.addedAt,
    }));
  }

  async getClassCounselorsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]> {
    const { classId } = dto;

    const result = await this.db
      .select({
        userId: classCounselors.counselorUserId,
        addedAt: classCounselors.createdAt,
        nameZh: userTable.nameZh,
        nameEn: userTable.nameEn,
      })
      .from(classCounselors)
      .leftJoin(userTable, eq(classCounselors.counselorUserId, userTable.id))
      .where(eq(classCounselors.classId, classId));

    return result.map((row) => ({
      userId: row.userId,
      name: {
        en: row.nameEn || '',
        zh: row.nameZh || '',
      },
      addedAt: row.addedAt,
    }));
  }
}
