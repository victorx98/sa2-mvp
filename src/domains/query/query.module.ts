import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { StudentQueryService } from "./services/student-query.service";

/**
 * Query Domain Module
 * 职责：
 * 1. 提供跨域查询服务
 * 2. 构建 Read Model
 * 3. 高效查询，可以直接 join 各域表
 */
@Module({
  imports: [DatabaseModule],
  providers: [StudentQueryService],
  exports: [StudentQueryService],
})
export class QueryModule {}

