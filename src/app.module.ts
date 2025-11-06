import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ApiModule } from './api/api.module';

/**
 * App Root Module
 * 职责：聚合所有顶层模块
 *
 * 架构层次（从上到下）：
 * 1. API Layer (Controllers) - 由 ApiModule 提供
 * 2. Operations Layer (BFF Services) - 由 ApiModule 导入
 * 3. Application Layer (Queries/Commands) - 由 OperationsModule 导入
 * 4. Domain Layer (Business Logic) - 由 ApplicationModule 导入
 * 5. Infrastructure Layer (Database) - 全局基础设施
 */
@Module({
  imports: [
    // 全局配置
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // 基础设施层
    DatabaseModule,

    // API 层（包含 Operations、Application、Domain 的依赖）
    ApiModule,
  ],
})
export class AppModule {}
