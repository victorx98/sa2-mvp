import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { databaseProviders } from "./database.provider";
import { DatabaseTraceService } from "./database-trace.service";
import { DATABASE_CONNECTION } from "./database.provider";
import { TRACED_DATABASE_CONNECTION } from "./traced-database.provider";

/**
 * 数据库模块
 * 
 * 提供：
 * 1. DATABASE_CONNECTION - 数据库连接（自动使用 @kubiks/otel-drizzle 进行追踪）
 * 2. TRACED_DATABASE_CONNECTION - 与 DATABASE_CONNECTION 相同（向后兼容别名）
 * 3. DatabaseTraceService - 数据库trace工具服务
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
    // 提供向后兼容的别名
    {
      provide: TRACED_DATABASE_CONNECTION,
      useExisting: DATABASE_CONNECTION,
    },
  ],
  exports: [
    ...databaseProviders,
    DatabaseTraceService,
    TRACED_DATABASE_CONNECTION,
  ],
})
export class DatabaseModule {}
