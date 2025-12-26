/**
 * Contract Query Repositories Module
 * 合同查询仓储模块
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { ContractModule } from '@domains/contract/contract.module';
import { CONTRACT_QUERY_REPOSITORY } from '../interfaces/contract-query.repository.interface';
import { DrizzleContractQueryRepository } from './repositories/drizzle-contract-query.repository';

@Module({
  imports: [DatabaseModule, ContractModule],
  providers: [
    {
      provide: CONTRACT_QUERY_REPOSITORY,
      useClass: DrizzleContractQueryRepository,
    },
  ],
  exports: [CONTRACT_QUERY_REPOSITORY],
})
export class ContractQueryRepositoriesModule {}

