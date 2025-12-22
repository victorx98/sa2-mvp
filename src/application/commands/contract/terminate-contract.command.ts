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
 * Terminate Contract Command (Application Layer)
 * [终止合同命令]
 *
 * 职责：
 * 1. 编排合同终止用例
 * 2. 验证合约状态（必须是ACTIVE或SUSPENDED）
 * 3. 验证终止原因
 * 4. 更新状态为TERMINATED
 * 5. 记录状态历史
 * 6. 管理事务
 */
@Injectable()
export class TerminateContractCommand extends CommandBase {
  /**
   * 执行终止合同用例
   * [Execute terminate contract use case]
   *
   * @param contractId 合同ID
   * @param reason 终止原因
   * @param terminatedBy 终止操作人ID
   * @returns 终止后的合同
   */
  async execute(contractId: string, reason: string, terminatedBy: string): Promise<Contract> {
    this.logger.debug(`Terminating contract: ${contractId}`);

    if (!reason || reason.trim().length === 0) {
      throw new ContractException("TERMINATION_REQUIRES_REASON", "Reason is required to terminate a contract");
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

      // 2. 验证当前状态必须是ACTIVE或SUSPENDED
      if (existing.status !== ContractStatus.ACTIVE &&
          existing.status !== ContractStatus.SUSPENDED) {
        throw new ContractException(
          "CONTRACT_NOT_TERMINATABLE",
          `Cannot terminate contract from status: ${existing.status}. Only ACTIVE or SUSPENDED contracts can be terminated.`
        );
      }

      // 3. 更新状态为TERMINATED
      const [updated] = await tx
        .update(schema.contracts)
        .set({
          status: ContractStatus.TERMINATED,
          updatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      // 4. 记录状态历史
      await tx.insert(schema.contractStatusHistory).values({
        contractId,
        fromStatus: existing.status,
        toStatus: ContractStatus.TERMINATED,
        changedAt: new Date(),
        changedBy: terminatedBy,
        reason: reason,
        metadata: {},
      });

      return updated;
    });

    this.logger.debug(`Contract terminated successfully: ${contract.id}`);
    return contract;
  }
}
