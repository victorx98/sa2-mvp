import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { UserController } from './controllers/user.controller';
import { OperationsModule } from '@operations/operations.module';

/**
 * API Layer - Root Module
 * 职责：
 * 1. 注册所有 Controllers
 * 2. 导入 Operations Layer
 */
@Module({
  imports: [
    OperationsModule, // 导入 Operations Layer (BFF)
  ],
  controllers: [
    AuthController,
    UserController,
  ],
})
export class ApiModule {}
