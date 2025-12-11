import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { classMentorsPrices } from '@infrastructure/database/schema/class-mentors-prices.schema';
import { classStudents } from '@infrastructure/database/schema/class-students.schema';
import { userTable } from '@infrastructure/database/schema/user.schema';
import type { DrizzleDatabase } from '@shared/types/database.types';

/**
 * Class Query Service (CQRS - Query)
 * 
 * Cross-domain Read Model aggregation layer
 * Handles read operations for class members with joins across domains
 * Joins: class_mentors_prices/class_students + users (for names)
 */
@Injectable()
export class ClassQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get class mentors with user names
   * JOIN class_mentors_prices with users table
   */
  async getClassMentorsWithNames(classId: string): Promise<any[]> {
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
      .where(eq(classMentorsPrices.classId, classId as any));

    return result.map((row) => {
      const nameEn = row.nameEn || '';
      const nameZh = row.nameZh || '';
      const name = nameEn && nameZh ? `${nameEn}(${nameZh})` : (nameEn || nameZh || 'Unknown');
      
      return {
        userId: row.userId,
        name,
        pricePerSession: row.pricePerSession,
        addedAt: row.addedAt,
      };
    });
  }

  /**
   * Get class students with user names
   * JOIN class_students with users table
   */
  async getClassStudentsWithNames(classId: string): Promise<any[]> {
    const result = await this.db
      .select({
        userId: classStudents.studentUserId,
        enrolledAt: classStudents.enrolledAt,
        nameZh: userTable.nameZh,
        nameEn: userTable.nameEn,
      })
      .from(classStudents)
      .leftJoin(userTable, eq(classStudents.studentUserId, userTable.id))
      .where(eq(classStudents.classId, classId as any));

    return result.map((row) => {
      const nameEn = row.nameEn || '';
      const nameZh = row.nameZh || '';
      const name = nameEn && nameZh ? `${nameEn}(${nameZh})` : (nameEn || nameZh || 'Unknown');
      
      return {
        userId: row.userId,
        name,
        enrolledAt: row.enrolledAt,
      };
    });
  }
}

