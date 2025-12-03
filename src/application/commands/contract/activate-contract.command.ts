import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ContractService } from '@domains/contract/services/contract.service';
import type { Contract } from '@infrastructure/database/schema';

/**
 * Activate Contract Command (Application Layer)
 * [激活合同命令]
 * 
 * 职责：
 * 1. 编排合同激活用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回激活后的合同
 */
@Injectable()
export class ActivateContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行激活合同用例
   * [Execute activate contract use case]
   * 
   * @param contractId 合同ID
   * @returns 激活后的合同
   */
  async execute(contractId: string): Promise<Contract> {
    try {
      this.logger.debug(`Activating contract: ${contractId}`);
      const contract = await this.contractService.activate(contractId);
      this.logger.debug(`Contract activated successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to activate contract: ${error.message}`, error.stack);
      throw error;
    }
  }
}