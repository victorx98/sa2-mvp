import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ContractService } from "@domains/contract/services/contract.service";
import type { Contract } from "@infrastructure/database/schema";
import { ContractStatus } from "@shared/types/contract-enums";

/**
 * Suspend Contract Command (Application Layer)
 * [暂停合同命令]
 *
 * 职责：
 * 1. 编排合同暂停用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回暂停后的合同
 */
@Injectable()
export class SuspendContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行暂停合同用例
   * [Execute suspend contract use case]
   *
   * @param contractId 合同ID
   * @param reason 暂停原因
   * @returns 暂停后的合同
   */
  async execute(contractId: string, reason: string): Promise<Contract> {
    try {
      this.logger.debug(`Suspending contract: ${contractId}`);
      const contract = await this.contractService.updateStatus(
        contractId,
        ContractStatus.SUSPENDED,
        { reason },
      );
      this.logger.debug(`Contract suspended successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(
        `Failed to suspend contract: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
