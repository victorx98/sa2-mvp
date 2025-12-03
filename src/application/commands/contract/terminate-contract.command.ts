import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ContractService } from '@domains/contract/services/contract.service';
import type { Contract } from '@infrastructure/database/schema';

/**
 * Terminate Contract Command (Application Layer)
 * [终止合同命令]
 * 
 * 职责：
 * 1. 编排合同终止用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回终止后的合同
 */
@Injectable()
export class TerminateContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行终止合同用例
   * [Execute terminate contract use case]
   * 
   * @param contractId 合同ID
   * @param reason 终止原因
   * @returns 终止后的合同
   */
  async execute(contractId: string, reason: string): Promise<Contract> {
    try {
      this.logger.debug(`Terminating contract: ${contractId}`);
      const contract = await this.contractService.terminate(contractId, reason);
      this.logger.debug(`Contract terminated successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to terminate contract: ${error.message}`, error.stack);
      throw error;
    }
  }
}