import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ContractService } from '@domains/contract/services/contract.service';
import { ConsumeServiceDto } from '@domains/contract/dto/consume-service.dto';

/**
 * Consume Service Command (Application Layer)
 * [消费服务命令]
 * 
 * 职责：
 * 1. 编排服务消费用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回执行结果
 */
@Injectable()
export class ConsumeServiceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super(db);
  }

  /**
   * 执行服务消费用例
   * [Execute consume service use case]
   * 
   * @param dto 服务消费DTO
   * @returns 执行结果
   */
  async execute(dto: ConsumeServiceDto): Promise<void> {
    try {
      this.logger.debug(`Consuming service for student: ${dto.studentId}`);
      await this.contractService.consumeService(dto);
      this.logger.debug(`Service consumed successfully for student: ${dto.studentId}`);
    } catch (error) {
      this.logger.error(`Failed to consume service: ${error.message}`, error.stack);
      throw error;
    }
  }
}