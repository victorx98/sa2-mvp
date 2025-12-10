import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';

/**
 * Domain Service - Student Counselor Relationship Management
 *
 * Responsibility:
 * - Query and manage relationships between students and counselors
 * - Get list of students associated with a counselor
 */
@Injectable()
export class StudentCounselorService {
  private readonly logger = new Logger(StudentCounselorService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get all student IDs for a given counselor
   * @param counselorId The ID of the counselor
   * @param tx Optional transaction context
   * @returns Array of student IDs
   */
  async getStudentIdsByCounselor(
    counselorId: string,
    tx?: DrizzleTransaction,
  ): Promise<string[]> {
    this.logger.debug(`Fetching student IDs for counselor: ${counselorId}`);

    const executor = tx || this.db;

    const records = await executor
      .select({ studentId: schema.studentCounselorTable.studentId })
      .from(schema.studentCounselorTable)
      .where(eq(schema.studentCounselorTable.counselorId, counselorId));

    const studentIds = records
      .map((record) => record.studentId)
      .filter((id): id is string => id !== null && id !== undefined);

    this.logger.debug(`Found ${studentIds.length} students for counselor ${counselorId}`);

    return studentIds;
  }
}

