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
 * Activate Contract Command (Application Layer)
 * [激活合同命令]
 *
 * 职责：
 * 1. 编排合同激活用例
 * 2. 验证合约状态（必须是SIGNED或SUSPENDED）
 * 3. 更新状态为ACTIVE
 * 4. 记录状态历史
 * 5. 管理事务
 */
@Injectable()
export class ActivateContractCommand extends CommandBase {
  /**
   * 执行激活合同用例
   * [Execute activate contract use case]
   *
   * @param contractId 合同ID
   * @param activatedBy 激活人ID
   * @returns 激活后的合同
   */
  async execute(contractId: string, activatedBy: string): Promise<Contract> {
    this.logger.debug(`Activating contract: ${contractId}`);

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

      // 2. 验证当前状态必须是SIGNED或SUSPENDED
      if (existing.status !== ContractStatus.SIGNED &&
          existing.status !== ContractStatus.SUSPENDED) {
        throw new ContractException(
          "INVALID_CONTRACT_STATUS",
          `Cannot activate contract from status: ${existing.status}. Only SIGNED or SUSPENDED contracts can be activated.`
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
        fromStatus: existing.status,
        toStatus: ContractStatus.ACTIVE,
        changedAt: new Date(),
        changedBy: activatedBy,
        reason: null,
        metadata: {},
      });

      return updated;
    });

    this.logger.debug(`Contract activated successfully: ${contract.id}`);
    return contract;
  }
}
