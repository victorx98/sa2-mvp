/**
 * Query Builder Module
 * NestJS 模块，提供 PrismaQueryService
 */

import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { PrismaQueryService } from './prisma-query.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [PrismaQueryService],
  exports: [PrismaQueryService],
})
export class QueryBuilderModule {}

