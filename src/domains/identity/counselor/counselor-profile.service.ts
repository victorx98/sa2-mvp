import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";
import type {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";

export interface UpdateCounselorProfileInput {
  status?: string;
}

@Injectable()
export class CounselorProfileService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async ensureProfile(userId: string, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    await executor
      .insert(schema.counselorTable)
      .values({
        id: userId,
        status: "active",
        createdBy: userId, // 显式设置创建者为当前用户
        updatedBy: userId, // 显式设置更新者为当前用户
      })
      .onConflictDoNothing({
        target: [schema.counselorTable.id],
      });
  }

  /**
   * Find counselor profile by user ID
   */
  async findByUserId(
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<schema.Counselor | null> {
    const executor: DrizzleExecutor = tx ?? this.db;

    const [profile] = await executor
      .select()
      .from(schema.counselorTable)
      .where(eq(schema.counselorTable.id, userId))
      .limit(1);

    return profile ?? null;
  }

  /**
   * Update counselor profile
   */
  async update(
    userId: string,
    input: UpdateCounselorProfileInput,
    updatedBy: string,
    tx?: DrizzleTransaction,
  ): Promise<schema.Counselor> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // Check if profile exists
    const existing = await this.findByUserId(userId, tx);
    if (!existing) {
      throw new NotFoundException(`Counselor profile not found for user ${userId}`);
    }

    // Build update values
    const updateValues: Partial<schema.InsertCounselor> = {
      updatedBy: updatedBy,
      modifiedTime: new Date(),
    };

    if (input.status !== undefined) updateValues.status = input.status;

    const [updated] = await executor
      .update(schema.counselorTable)
      .set(updateValues)
      .where(eq(schema.counselorTable.id, userId))
      .returning();

    return updated;
  }
}
