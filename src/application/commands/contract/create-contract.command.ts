import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ContractService } from '@domains/contract/services/contract.service';
import { CreateContractDto } from '@domains/contract/dto/create-contract.dto';
import type { Contract } from '@infrastructure/database/schema';

/**
 * Create Contract Command (Application Layer)
 * [创建合同命令]
 * 
 * 职责：
 * 1. 编排合同创建用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回创建的合同
 */
@Injectable()
export class CreateContractCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行创建合同用例
   * [Execute create contract use case]
   * 
   * @param input 创建合同输入参数
   * @returns 创建的合同
   */
  async execute(input: CreateContractDto): Promise<Contract> {
    try {
      this.logger.debug(`Creating contract for student: ${input.studentId}`);
      const contract = await this.contractService.create(input);
      this.logger.debug(`Contract created successfully: ${contract.id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to create contract: ${error.message}`, error.stack);
      throw error;
    }
  }
}
