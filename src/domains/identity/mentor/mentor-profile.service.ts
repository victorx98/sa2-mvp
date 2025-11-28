import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";
import type {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";

export interface UpdateMentorProfileInput {
  status?: string;
  type?: string | null;
  company?: string | null;
  companyTitle?: string | null;
  briefIntro?: string | null;
  highSchool?: string | null;
  location?: string | null;
  level?: string | null;
  rating?: number | null;
  underCollege?: string | null;
  underMajor?: string | null;
  graduateCollege?: string | null;
  graduateMajor?: string | null;
}

@Injectable()
export class MentorProfileService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async ensureProfile(userId: string, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    await executor
      .insert(schema.mentorTable)
      .values({
        id: userId,
        status: "pending_review",
        createdBy: userId, // 显式设置创建者为当前用户
        updatedBy: userId, // 显式设置更新者为当前用户
      })
      .onConflictDoNothing({
        target: [schema.mentorTable.id],
      });
  }

  /**
   * Find mentor profile by user ID
   */
  async findByUserId(
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<schema.Mentor | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [profile] = await executor
      .select()
      .from(schema.mentorTable)
      .where(eq(schema.mentorTable.id, userId))
      .limit(1);

    return profile ?? null;
  }

  /**
   * Update mentor profile
   */
  async update(
    userId: string,
    input: UpdateMentorProfileInput,
    updatedBy: string,
    tx?: DrizzleTransaction,
  ): Promise<schema.Mentor> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // Check if profile exists
    const existing = await this.findByUserId(userId, tx);
    if (!existing) {
      throw new NotFoundException(`Mentor profile not found for user ${userId}`);
    }

    // Build update values
    const updateValues: Partial<schema.InsertMentor> = {
      updatedBy: updatedBy,
      modifiedTime: new Date(),
    };

    if (input.status !== undefined) updateValues.status = input.status;
    if (input.type !== undefined) updateValues.type = input.type;
    if (input.company !== undefined) updateValues.company = input.company;
    if (input.companyTitle !== undefined) updateValues.companyTitle = input.companyTitle;
    if (input.briefIntro !== undefined) updateValues.briefIntro = input.briefIntro;
    if (input.highSchool !== undefined) updateValues.highSchool = input.highSchool;
    if (input.location !== undefined) updateValues.location = input.location;
    if (input.level !== undefined) updateValues.level = input.level;
    if (input.rating !== undefined) updateValues.rating = input.rating;
    if (input.underCollege !== undefined) updateValues.underCollege = input.underCollege;
    if (input.underMajor !== undefined) updateValues.underMajor = input.underMajor;
    if (input.graduateCollege !== undefined) updateValues.graduateCollege = input.graduateCollege;
    if (input.graduateMajor !== undefined) updateValues.graduateMajor = input.graduateMajor;

    const [updated] = await executor
      .update(schema.mentorTable)
      .set(updateValues)
      .where(eq(schema.mentorTable.id, userId))
      .returning();

    return updated;
  }
}
