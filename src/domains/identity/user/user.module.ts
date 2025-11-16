import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { UserService } from "./user-service";
import { USER_SERVICE } from "./user-interface";

/**
 * User Domain Module
 * 用户领域模块
 *
 * 职责：
 * 1. 提供用户相关的领域服务
 * 2. 管理用户数据的 CRUD 操作
 * 3. 提供用户身份验证和授权相关的数据访问
 *
 * 设计原则：
 * - DDD (Domain-Driven Design) - 领域驱动设计
 * - Repository Pattern - 仓储模式（通过 Service 实现）
 * - Dependency Injection - 依赖注入
 *
 * 实现的服务：
 * ✅ UserService - 用户数据访问服务
 *   - findById - 根据ID查找用户
 *   - findByIdWithRoles - 根据ID查找用户并返回角色
 *   - findByEmail - 根据邮箱查找用户
 *   - create/createWithRoles - 创建新用户
 *   - assignRoles - 分配角色
 *   - update - 更新用户信息
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    // User Service
    UserService,
    // Provide UserService with USER_SERVICE token for dependency injection
    {
      provide: USER_SERVICE,
      useClass: UserService,
    },
  ],
  exports: [
    // Export UserService for use in other modules
    UserService,
    // Export USER_SERVICE token for dependency injection
    USER_SERVICE,
  ],
})
export class UserModule {}
