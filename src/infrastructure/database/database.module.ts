import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { databaseProviders } from "./database.provider";
import { DatabaseTraceService } from "./database-trace.service";
import { TRACED_DATABASE_CONNECTION, createTracedDatabase } from "./traced-database.provider";
import { DATABASE_CONNECTION } from "./database.provider";

/**
 * 数据库模块
 * 
 * 提供：
 * 1. DATABASE_CONNECTION - 原始数据库连接（不带自动trace）
 * 2. TRACED_DATABASE_CONNECTION - 增强的数据库连接（带自动trace）
 * 3. DatabaseTraceService - 数据库trace工具服务
 * 
 * 推荐使用 TRACED_DATABASE_CONNECTION 以获得自动trace功能
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ...databaseProviders,
    DatabaseTraceService,
    // 提供traced数据库连接
    {
      provide: TRACED_DATABASE_CONNECTION,
      useFactory: (db) => {
        // 只在非测试环境启用自动trace
        if (process.env.NODE_ENV === "test" || process.env.OTEL_ENABLED === "false") {
          return db;
        }
        return createTracedDatabase(db);
      },
      inject: [DATABASE_CONNECTION],
    },
  ],
  exports: [
    ...databaseProviders,
    DatabaseTraceService,
    TRACED_DATABASE_CONNECTION,
  ],
})
export class DatabaseModule {}
