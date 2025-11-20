import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";

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
        userId,
        status: "active",
        createdBy: userId, // 显式设置创建者为当前用户
        updatedBy: userId, // 显式设置更新者为当前用户
      })
      .onConflictDoNothing({
        target: [schema.studentTable.userId],
      });
  }
}
