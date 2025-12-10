import { Inject, Injectable } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { ContractService } from "@domains/contract/services/contract.service";
import { UpdateContractStatusDto } from "@domains/contract/dto/update-contract-status.dto";

/**
 * Update Contract Status Command
 * [更新合同状态命令]
 *
 * Used for updating contract status through unified endpoint
 * [用于通过统一端点更新合同状态]
 */
@Injectable()
export class UpdateContractStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   *
   * @param id Contract ID [合同ID]
   * @param dto Status update DTO [状态更新DTO]
   * @param userId Current user ID (optional, used for sign operation) [当前用户ID（可选，用于签署操作）]
   * @returns Updated contract [更新后的合同]
   */
  async execute(id: string, dto: UpdateContractStatusDto, userId?: string) {
    // [修复] Input validation [输入验证]
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new Error("Contract ID is required and must be a non-empty string");
    }
    if (!dto || !dto.status) {
      throw new Error("Status is required");
    }

    // [修复] Remove outer transaction as updateStatus() already uses transaction internally [移除外层事务，因为updateStatus()内部已使用事务]
    // Note: updateStatus() method handles transaction internally, so outer transaction is unnecessary [注意：updateStatus()方法内部处理事务，因此外层事务是不必要的]
    return this.contractService.updateStatus(id, dto.status, {
      reason: dto.reason,
      signedBy: dto.signedBy || userId,
    });
  }
}
