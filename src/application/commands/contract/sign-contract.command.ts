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
 * Sign Contract Command (Application Layer)
 * [签署合同命令]
 *
 * 职责：
 * 1. 编排合同签署用例
 * 2. 验证合约状态（必须是DRAFT）
 * 3. 更新状态为SIGNED
 * 4. 记录状态历史
 * 5. 管理事务
 */
@Injectable()
export class SignContractCommand extends CommandBase {
  /**
   * 执行签署合同用例
   * [Execute sign contract use case]
   *
   * @param contractId 合同ID
   * @param signedBy 签署人ID
   * @returns 签署后的合同
   */
  async execute(contractId: string, signedBy: string): Promise<Contract> {
    this.logger.debug(`Signing contract: ${contractId}`);

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

      // 2. 验证当前状态必须是DRAFT
      if (existing.status !== ContractStatus.DRAFT) {
        throw new ContractException("CONTRACT_NOT_DRAFT");
      }

      // 3. 更新状态为SIGNED
      const [updated] = await tx
        .update(schema.contracts)
        .set({
          status: ContractStatus.SIGNED,
          updatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      // 4. 记录状态历史
      await tx.insert(schema.contractStatusHistory).values({
        contractId,
        fromStatus: ContractStatus.DRAFT,
        toStatus: ContractStatus.SIGNED,
        changedAt: new Date(),
        changedBy: signedBy,
        reason: null,
        metadata: {},
      });

      return updated;
    });

    this.logger.debug(`Contract signed successfully: ${contract.id}`);
    return contract;
  }
}
