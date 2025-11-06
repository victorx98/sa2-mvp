import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';

/**
 * Domain Layer - Contract Module
 */
@Module({
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
