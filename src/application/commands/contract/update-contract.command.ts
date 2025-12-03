import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ContractService } from '@domains/contract/services/contract.service';
import { UpdateContractDto } from '@domains/contract/dto/update-contract.dto';
import type { Contract } from '@infrastructure/database/schema';

/**
 * Update Contract Command (Application Layer)
 * [更新合同命令]
 * 
 * 职责：
 * 1. 编排合同更新用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回更新后的合同
 */
@Injectable()
export class UpdateContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行更新合同用例
   * [Execute update contract use case]
   * 
   * @param contractId 合同ID
   * @param dto 更新合同DTO
   * @returns 更新后的合同
   */
  async execute(contractId: string, dto: UpdateContractDto): Promise<Contract> {
    try {
      this.logger.debug(`Updating contract: ${contractId}`);
      const contract = await this.contractService.update(contractId, dto);
      this.logger.debug(`Contract updated successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to update contract: ${error.message}`, error.stack);
      throw error;
    }
  }
}