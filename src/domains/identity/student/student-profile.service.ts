import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";
import type {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";

export interface IUpdateStudentProfileInput {
  status?: string;
  highSchool?: string | null;
  underCollege?: string | null;
  underMajor?: string | null;
  graduateCollege?: string | null;
  graduateMajor?: string | null;
  aiResumeSummary?: string | null;
  customerImportance?: string | null;
  graduationDate?: string | null;
  grades?: string | null;
}

@Injectable()
export class StudentProfileService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async ensureProfile(userId: string, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    await executor
      .insert(schema.studentTable)
      .values({
        id: userId,
        status: "active",
        createdBy: userId, // 显式设置创建者为当前用户
        updatedBy: userId, // 显式设置更新者为当前用户
      })
      .onConflictDoNothing({
        target: [schema.studentTable.id],
      });
  }

  /**
   * Find student profile by user ID
   */
  async findByUserId(
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<schema.Student | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [profile] = await executor
      .select()
      .from(schema.studentTable)
      .where(eq(schema.studentTable.id, userId))
      .limit(1);

    return profile ?? null;
  }

  /**
   * Update student profile
   */
  async update(
    userId: string,
    input: IUpdateStudentProfileInput,
    updatedBy: string,
    tx?: DrizzleTransaction,
  ): Promise<schema.Student> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // Check if profile exists
    const existing = await this.findByUserId(userId, tx);
    if (!existing) {
      throw new NotFoundException(`Student profile not found for user ${userId}`);
    }

    // Build update values
    const updateValues: Partial<schema.InsertStudent> = {
      updatedBy: updatedBy,
      modifiedTime: new Date(),
    };

    if (input.status !== undefined) updateValues.status = input.status;
    if (input.highSchool !== undefined) updateValues.highSchool = input.highSchool;
    if (input.underCollege !== undefined) updateValues.underCollege = input.underCollege;
    if (input.underMajor !== undefined) updateValues.underMajor = input.underMajor;
    if (input.graduateCollege !== undefined) updateValues.graduateCollege = input.graduateCollege;
    if (input.graduateMajor !== undefined) updateValues.graduateMajor = input.graduateMajor;
    if (input.aiResumeSummary !== undefined) updateValues.aiResumeSummary = input.aiResumeSummary;
    if (input.customerImportance !== undefined) updateValues.customerImportance = input.customerImportance;
    if (input.graduationDate !== undefined) updateValues.graduationDate = input.graduationDate;
    if (input.grades !== undefined) updateValues.grades = input.grades;

    const [updated] = await executor
      .update(schema.studentTable)
      .set(updateValues)
      .where(eq(schema.studentTable.id, userId))
      .returning();

    return updated;
  }
}
