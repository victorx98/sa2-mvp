import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CommandBase } from "@application/core/command.base";
import type { Contract } from "@infrastructure/database/schema";
import * as schema from "@infrastructure/database/schema";
import { ContractStatus } from "@shared/types/contract-enums";
import {
  ContractException,
  ContractNotFoundException,
} from "@domains/contract/common/exceptions/contract.exception";

/**
 * Suspend Contract Command (Application Layer)
 * [暂停合同命令]
 *
 * 职责：
 * 1. 编排合同暂停用例
 * 2. 验证合约状态（必须是ACTIVE）
 * 3. 验证暂停原因
 * 4. 更新状态为SUSPENDED
 * 5. 记录状态历史
 * 6. 管理事务
 */
@Injectable()
export class SuspendContractCommand extends CommandBase {
  /**
   * 执行暂停合同用例
   * [Execute suspend contract use case]
   *
   * @param contractId 合同ID
   * @param reason 暂停原因
   * @param suspendedBy 暂停操作人ID
   * @returns 暂停后的合同
   */
  async execute(contractId: string, reason: string, suspendedBy: string): Promise<Contract> {
    this.logger.debug(`Suspending contract: ${contractId}`);

    if (!reason || reason.trim().length === 0) {
      throw new ContractException("SUSPENSION_REQUIRES_REASON", "Reason is required to suspend a contract");
    }

    const contract = await this.db.transaction(async (tx) => {
      // 1. 查询合约并加行锁
      const [existing] = await tx
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);

      if (!existing) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      // 2. 验证当前状态必须是ACTIVE
      if (existing.status !== ContractStatus.ACTIVE) {
        throw new ContractException(
          "CONTRACT_NOT_ACTIVE",
          `Cannot suspend contract. Contract must be in ACTIVE status, but current status is ${existing.status}`
        );
      }

      // 3. 更新状态为SUSPENDED
      const [updated] = await tx
        .update(schema.contracts)
        .set({
          status: ContractStatus.SUSPENDED,
          updatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      // 4. 记录状态历史
      await tx.insert(schema.contractStatusHistory).values({
        contractId,
        fromStatus: ContractStatus.ACTIVE,
        toStatus: ContractStatus.SUSPENDED,
        changedAt: new Date(),
        changedBy: suspendedBy,
        reason: reason,
        metadata: {},
      });

      return updated;
    });

    this.logger.debug(`Contract suspended successfully: ${contract.id}`);
    return contract;
  }
}
