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
 * Resume Contract Command (Application Layer)
 * [恢复合同命令]
 *
 * 职责：
 * 1. 编排合同恢复用例
 * 2. 验证合约状态（必须是SUSPENDED）
 * 3. 更新状态为ACTIVE
 * 4. 记录状态历史
 * 5. 管理事务
 */
@Injectable()
export class ResumeContractCommand extends CommandBase {
  /**
   * 执行恢复合同用例
   * [Execute resume contract use case]
   *
   * @param contractId 合同ID
   * @param resumedBy 恢复操作人ID
   * @returns 恢复后的合同
   */
  async execute(contractId: string, resumedBy: string): Promise<Contract> {
    this.logger.debug(`Resuming contract: ${contractId}`);

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

      // 2. 验证当前状态必须是SUSPENDED
      if (existing.status !== ContractStatus.SUSPENDED) {
        throw new ContractException(
          "CONTRACT_NOT_SUSPENDED",
          `Cannot resume contract. Contract must be in SUSPENDED status, but current status is ${existing.status}`
        );
      }

      // 3. 更新状态为ACTIVE
      const [updated] = await tx
        .update(schema.contracts)
        .set({
          status: ContractStatus.ACTIVE,
          updatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      // 4. 记录状态历史
      await tx.insert(schema.contractStatusHistory).values({
        contractId,
        fromStatus: ContractStatus.SUSPENDED,
        toStatus: ContractStatus.ACTIVE,
        changedAt: new Date(),
        changedBy: resumedBy,
        reason: null,
        metadata: {},
      });

      return updated;
    });

    this.logger.debug(`Contract resumed successfully: ${contract.id}`);
    return contract;
  }
}
