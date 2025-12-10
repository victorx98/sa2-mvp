import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ContractService } from "@domains/contract/services/contract.service";
import type { Contract } from "@infrastructure/database/schema";
import { ContractStatus } from "@shared/types/contract-enums";

/**
 * Sign Contract Command (Application Layer)
 * [签署合同命令]
 *
 * 职责：
 * 1. 编排合同签署用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回签署后的合同
 */
@Injectable()
export class SignContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行签署合同用例
   * [Execute sign contract use case]
   *
   * @param contractId 合同ID
   * @param signedBy 签署人ID
   * @returns 签署后的合同
   */
  async execute(contractId: string, signedBy: string): Promise<Contract> {
    try {
      this.logger.debug(`Signing contract: ${contractId}`);
      const contract = await this.contractService.updateStatus(
        contractId,
        ContractStatus.SIGNED,
        { signedBy },
      );
      this.logger.debug(`Contract signed successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(
        `Failed to sign contract: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
