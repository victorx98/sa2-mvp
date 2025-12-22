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
 * Complete Contract Command (Application Layer)
 * [完成合同命令]
 *
 * 职责：
 * 1. 编排合同完成用例
 * 2. 验证合约状态（必须是ACTIVE）
 * 3. 更新状态为COMPLETED
 * 4. 记录状态历史
 * 5. 管理事务
 */
@Injectable()
export class CompleteContractCommand extends CommandBase {
  /**
   * 执行完成合同用例
   * [Execute complete contract use case]
   *
   * @param contractId 合同ID
   * @param completedBy 完成操作人ID
   * @returns 完成后的合同
   */
  async execute(contractId: string, completedBy: string): Promise<Contract> {
    this.logger.debug(`Completing contract: ${contractId}`);

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
          `Cannot complete contract. Contract must be in ACTIVE status, but current status is ${existing.status}`
        );
      }

      // 3. 更新状态为COMPLETED
      const [updated] = await tx
        .update(schema.contracts)
        .set({
          status: ContractStatus.COMPLETED,
          updatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      // 4. 记录状态历史
      await tx.insert(schema.contractStatusHistory).values({
        contractId,
        fromStatus: ContractStatus.ACTIVE,
        toStatus: ContractStatus.COMPLETED,
        changedAt: new Date(),
        changedBy: completedBy,
        reason: null,
        metadata: {},
      });

      return updated;
    });

    this.logger.debug(`Contract completed successfully: ${contract.id}`);
    return contract;
  }
}
