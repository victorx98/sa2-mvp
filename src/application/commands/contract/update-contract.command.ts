import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CommandBase } from "@application/core/command.base";
import { UpdateContractDto } from "@api/dto/request/contract/contract.request.dto";
import type { Contract } from "@infrastructure/database/schema";
import * as schema from "@infrastructure/database/schema";
import { ContractStatus } from "@shared/types/contract-enums";
import {
  ContractException,
  ContractNotFoundException,
} from "@domains/contract/common/exceptions/contract.exception";

/**
 * Update Contract Command (Application Layer)
 * [更新合同命令]
 *
 * 职责：
 * 1. 编排合同更新用例
 * 2. 验证合同存在
 * 3. 验证合同状态（必须是DRAFT）
 * 4. 验证更新字段
 * 5. 构建更新数据
 * 6. 执行更新
 * 7. 管理事务
 */
@Injectable()
export class UpdateContractCommand extends CommandBase {
  /**
   * 执行更新合同用例
   * [Execute update contract use case]
   *
   * @param contractId 合同ID
   * @param dto 更新合同DTO
   * @returns 更新后的合同
   */
  async execute(contractId: string, dto: UpdateContractDto): Promise<Contract> {
    this.logger.debug(`Updating contract: ${contractId}`);

    if (!dto) {
      throw new ContractException("INVALID_DTO", "Update data is required");
    }

    const updatedContract = await this.db.transaction(async (tx) => {
      // 1. 验证合同存在
      const contract = await tx.query.contracts.findFirst({
        where: eq(schema.contracts.id, contractId),
      });

      if (!contract) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      // 2. 验证合同状态（必须是DRAFT）
      if (contract.status !== ContractStatus.DRAFT) {
        throw new ContractException(
          "CONTRACT_NOT_DRAFT",
          `Only draft contracts can be updated. Current status: ${contract.status}`,
        );
      }

      // 3. 构建更新数据
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.totalAmount !== undefined) updateData.totalAmount = dto.totalAmount;
      if (dto.currency !== undefined) updateData.currency = dto.currency;
      if (dto.validityDays !== undefined)
        updateData.validityDays = dto.validityDays;

      if (dto.currency !== undefined && dto.totalAmount === undefined) {
        updateData.totalAmount = parseFloat(contract.totalAmount.toString());
      }

      // 4. 验证是否有字段需要更新
      if (Object.keys(updateData).length === 1) {
        throw new ContractException(
          "NO_FIELDS_TO_UPDATE",
          "No fields provided for update",
        );
      }

      // 5. 执行更新
      const [updated] = await tx
        .update(schema.contracts)
        .set(updateData)
        .where(eq(schema.contracts.id, contractId))
        .returning();

      return updated;
    });

    this.logger.debug(`Contract updated successfully: ${updatedContract.id}`);
    return updatedContract;
  }
}
