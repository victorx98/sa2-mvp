import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { CreateMentorPriceDto } from "@api/dto/request/financial/mentor-price.request.dto";
import type { MentorPrice } from "@infrastructure/database/schema";
import * as schema from "@infrastructure/database/schema";
import {
  validateMentorPrice,
  validateCurrency,
  validateStatus,
} from "@domains/financial/common/utils/validation.utils";
import {
  FinancialConflictException,
} from "@domains/financial/common/exceptions/financial.exception";

/**
 * Create Mentor Price Command (Application Layer)
 * [创建导师价格命令]
 *
 * 职责：
 * 1. 编排导师价格创建用例
 * 2. 验证输入数据（价格有效性、货币、状态）
 * 3. 检查导师价格是否已存在（同一时间类型的活跃价格）
 * 4. 创建导师价格记录
 * 5. 管理事务
 */
@Injectable()
export class CreateMentorPriceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行创建导师价格用例
   * [Execute create mentor price use case]
   *
   * @param input - 创建导师价格输入（包含DTO和更新人）
   * @returns 创建的导师价格记录
   */
  async execute(input: {
    dto: CreateMentorPriceDto;
    updatedBy?: string;
  }): Promise<MentorPrice> {
    const { dto, updatedBy } = input;

    this.logger.debug(
      `Creating mentor price for mentor: ${dto.mentorUserId}, session type: ${dto.sessionTypeCode}`,
    );

    // 1. 验证输入数据
    validateMentorPrice(dto.price);

    if (dto.currency) {
      validateCurrency(dto.currency);
    }

    if (dto.status) {
      validateStatus(dto.status);
    }

    // 2. 检查导师价格是否已存在（同一时间类型的活跃价格）
    const existingPrice = await this.db.query.mentorPrices.findFirst({
      where: and(
        eq(schema.mentorPrices.mentorUserId, dto.mentorUserId),
        eq(schema.mentorPrices.sessionTypeCode, dto.sessionTypeCode),
        eq(schema.mentorPrices.status, "active"),
      ),
    });

    if (existingPrice) {
      throw new FinancialConflictException("MENTOR_PRICE_ALREADY_EXISTS");
    }

    // 3. 创建导师价格记录
    const [mentorPrice] = await this.db
      .insert(schema.mentorPrices)
      .values({
        mentorUserId: dto.mentorUserId,
        sessionTypeCode: dto.sessionTypeCode,
        price: String(dto.price),
        currency: dto.currency || "USD",
        status: dto.status || "active",
        packageCode: dto.packageCode,
        updatedBy: updatedBy || '',
        updatedAt: new Date(),
      })
      .returning();

    this.logger.debug(`Mentor price created successfully: ${mentorPrice.id}`);

    return mentorPrice;
  }
}

