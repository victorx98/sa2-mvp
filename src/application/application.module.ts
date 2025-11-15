import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import type { StringValue } from "ms";

// Infrastructure
import { DatabaseModule } from "@infrastructure/database/database.module";

// Domain Layer
import { UserModule } from "@domains/identity/user/user.module";

// Application Layer - Queries
import { UserQueryService } from "./queries/user-query.service";
import { StudentListQuery } from "./queries/student/student-list.query";

// Application Layer - Commands
import { RegisterCommand } from "./commands/auth/register.command";
import { LoginCommand } from "./commands/auth/login.command";
import { BookSessionCommand } from "./commands/booking/book-session.command";

// Application Layer - Commands (兼容层)
import { AuthCommandService } from "./commands/auth-command/auth-command.service";

// Core Services (从main分支)
import { CalendarService } from "@core/calendar";
import { MeetingProviderModule } from "@core/meeting-providers";
import { TelemetryModule } from "@telemetry/telemetry.module";

// Domain Services
import { SessionModule } from "@domains/services/session/session.module";
import { ContractModule } from "@domains/contract/contract.module";
import { QueryModule } from "@domains/query/query.module";

// Shared
import { JwtStrategy } from "@shared/guards/strategies/jwt.strategy";

/**
 * Application Layer - Root Module
 * 职责：
 * 1. 注册所有 Queries
 * 2. 注册所有 Commands
 * 3. 注册所有 Sagas
 * 4. 导出供 Operations Layer 使用
 */
@Module({
  imports: [
    DatabaseModule, // 导入数据库模块，提供事务支持
    MeetingProviderModule, // 导入会议提供者模块
    TelemetryModule, // 提供 MetricsService 等遥测服务
    UserModule, // Domain层：User (Identity)
    SessionModule, // Domain层：Session
    ContractModule, // Domain层：Contract
    QueryModule, // Domain层：Query (跨域查询)
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: (configService.get<string>("JWT_EXPIRATION") || "24h") as
            | StringValue
            | number,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Core Services
    CalendarService,

    // Queries
    UserQueryService,
    StudentListQuery,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,

    // Commands (兼容层)
    AuthCommandService,

    // Shared
    JwtStrategy,
  ],
  exports: [
    // Core Services
    CalendarService,
    MeetingProviderModule,

    // Domain Services
    UserModule,
    SessionModule,
    ContractModule,

    // Queries
    UserQueryService,
    StudentListQuery,

    // Commands
    RegisterCommand,
    LoginCommand,
    BookSessionCommand,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,

    // Shared
    JwtStrategy,
    PassportModule,
  ],
})
export class ApplicationModule {}
