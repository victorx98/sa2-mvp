import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ContractService } from '@domains/contract/services/contract.service';
import { AddAmendmentLedgerDto } from '@domains/contract/dto/add-amendment-ledger.dto';
import type { ContractServiceEntitlement } from '@infrastructure/database/schema';

/**
 * Add Amendment Ledger Command (Application Layer)
 * [添加权益变更台账命令]
 * 
 * 职责：
 * 1. 编排权益变更台账添加用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回更新后的服务权益
 */
@Injectable()
export class AddAmendmentLedgerCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行添加权益变更台账用例
   * [Execute add amendment ledger use case]
   * 
   * @param dto 权益变更台账DTO
   * @returns 更新后的服务权益
   */
  async execute(dto: AddAmendmentLedgerDto): Promise<ContractServiceEntitlement> {
    try {
      this.logger.debug(`Adding amendment ledger for student: ${dto.studentId}`);
      const entitlement = await this.contractService.addAmendmentLedger(dto);
      this.logger.debug(`Amendment ledger added successfully for student: ${dto.studentId}`);
      return entitlement;
    } catch (error) {
      this.logger.error(`Failed to add amendment ledger: ${error.message}`, error.stack);
      throw error;
    }
  }
}