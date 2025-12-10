import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ContractService } from "@domains/contract/services/contract.service";
import type { Contract } from "@infrastructure/database/schema";
import { ContractStatus } from "@shared/types/contract-enums";

/**
 * Complete Contract Command (Application Layer)
 * [完成合同命令]
 *
 * 职责：
 * 1. 编排合同完成用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回完成后的合同
 */
@Injectable()
export class CompleteContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行完成合同用例
   * [Execute complete contract use case]
   *
   * @param contractId 合同ID
   * @returns 完成后的合同
   */
  async execute(contractId: string): Promise<Contract> {
    try {
      this.logger.debug(`Completing contract: ${contractId}`);
      const contract = await this.contractService.updateStatus(
        contractId,
        ContractStatus.COMPLETED,
      );
      this.logger.debug(`Contract completed successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(
        `Failed to complete contract: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
