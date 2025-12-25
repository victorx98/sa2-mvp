/**
 * Product Query Repositories Module
 * 产品查询仓储模块
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { PRODUCT_QUERY_REPOSITORY } from '../interfaces/product-query.repository.interface';
import { DrizzleProductQueryRepository } from './repositories/drizzle-product-query.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PRODUCT_QUERY_REPOSITORY,
      useClass: DrizzleProductQueryRepository,
    },
  ],
  exports: [PRODUCT_QUERY_REPOSITORY],
})
export class ProductQueryRepositoriesModule {}

