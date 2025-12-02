import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { ContractService } from '@domains/contract/services/contract.service';
import { FindOneContractDto } from '@domains/contract/dto/find-one-contract.dto';
import type { Contract } from '@infrastructure/database/schema';

/**
 * Get Contract Query (Application Layer)
 * [获取合同查询]
 * 
 * 职责：
 * 1. 编排获取合同详情用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回合同详情
 */
@Injectable()
export class GetContractQuery extends QueryBase {
  constructor(
    private readonly contractService: ContractService,
  ) {
    super();
  }

  /**
   * 执行获取合同详情用例
   * [Execute get contract detail use case]
   * 
   * @param input 查询合同输入参数
   * @returns 合同详情
   */
  async execute(input: FindOneContractDto): Promise<Contract | null> {
    return this.withErrorHandling(async () => {
      this.logger.debug(`Getting contract: ${input.contractId || input.contractNumber}`);
      const contract = await this.contractService.findOne(input);
      this.logger.debug(`Contract retrieved successfully: ${contract?.id || 'not found'}`);
      return contract;
    });
  }
}
