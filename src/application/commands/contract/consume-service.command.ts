import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ContractService } from "@domains/contract/services/contract.service";
import { ConsumeServiceDto } from "@domains/contract/dto/consume-service.dto";

/**
 * Consume Service Command (Application Layer)
 * [消费服务命令]
 *
 * 职责：
 * 1. 编排服务消费用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回执行结果
 */
@Injectable()
export class ConsumeServiceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行服务消费用例
   * [Execute consume service use case]
   *
   * @param dto 服务消费DTO
   * @param userId 用户ID（来自用户上下文）
   * @returns 执行结果
   */
  async execute(
    dto: ConsumeServiceDto,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Input validation [输入验证]
    if (!dto) {
      throw new Error("ConsumeServiceDto is required");
    }
    if (
      !dto.studentId ||
      typeof dto.studentId !== "string" ||
      dto.studentId.trim().length === 0
    ) {
      throw new Error("Student ID is required and must be a non-empty string");
    }
    if (
      !dto.serviceType ||
      typeof dto.serviceType !== "string" ||
      dto.serviceType.trim().length === 0
    ) {
      throw new Error(
        "Service type is required and must be a non-empty string",
      );
    }
    if (
      dto.quantity === undefined ||
      dto.quantity === null ||
      typeof dto.quantity !== "number" ||
      dto.quantity <= 0
    ) {
      throw new Error("Quantity is required and must be a positive number");
    }
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("UserId is required and must be a non-empty string");
    }

    try {
      this.logger.debug(`Consuming service for student: ${dto.studentId}`);
      await this.contractService.consumeService(dto, userId);
      this.logger.debug(
        `Service consumed successfully for student: ${dto.studentId}`,
      );
      return {
        success: true,
        message: "Service consumed successfully",
      };
    } catch (error) {
      this.logger.error(
        `Failed to consume service: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
