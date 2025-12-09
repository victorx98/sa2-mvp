import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { databaseProviders } from "./database.provider";
import { DatabaseTraceService } from "./database-trace.service";

/**
 * 数据库模块
 * 
 * 提供：
 * 1. DATABASE_CONNECTION - 数据库连接（自动使用 @kubiks/otel-drizzle 进行追踪）
 * 2. DatabaseTraceService - 数据库trace工具服务
 * 
 * 注意：DATABASE_CONNECTION 已自动使用 @kubiks/otel-drizzle 包装，
 * 所有数据库操作会自动上报到 Grafana Cloud，包括：
 * - SQL 语句
 * - 操作类型（SELECT/INSERT/UPDATE/DELETE）
 * - 执行时长
 * - 表名
 * - 错误信息（如有）
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ...databaseProviders,
    DatabaseTraceService,
  ],
  exports: [
    ...databaseProviders,
    DatabaseTraceService,
  ],
})
export class DatabaseModule {}
