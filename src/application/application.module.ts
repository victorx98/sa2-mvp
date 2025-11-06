import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Infrastructure
import { DatabaseModule } from '@infrastructure/database/database.module';

// Domain Layer
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { USER_REPOSITORY } from '@domains/identity/user/user-repository.interface';

// Application Layer - Queries
import { UserQueryService } from './queries/user-query.service';

// Application Layer - UseCases
import { RegisterUseCase } from './use-cases/auth/register.use-case';
import { LoginUseCase } from './use-cases/auth/login.use-case';
import { BookSessionUseCase } from './use-cases/booking/book-session.use-case';

// Application Layer - Commands (兼容层)
import { AuthCommandService } from './commands/auth-command/auth-command.service';

// Core Services (从main分支)
import { CalendarService } from '@core/calendar';
import { MeetingProviderModule } from '@core/meeting-providers';

// Domain Services
import { SessionModule } from '@domains/services/session/session.module';
import { ContractModule } from '@domains/contract/contract.module';

// Shared
import { JwtStrategy } from '@shared/guards/strategies/jwt.strategy';

/**
 * Application Layer - Root Module
 * 职责：
 * 1. 注册所有 Queries
 * 2. 注册所有 UseCases
 * 3. 注册所有 Sagas
 * 4. 导出供 Operations Layer 使用
 */
@Module({
  imports: [
    DatabaseModule, // 导入数据库模块，提供事务支持
    MeetingProviderModule, // 导入会议提供者模块
    SessionModule, // Domain层：Session
    ContractModule, // Domain层：Contract
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION') || '24h',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Domain Repositories
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },

    // Core Services
    CalendarService,

    // Queries
    UserQueryService,

    // UseCases
    RegisterUseCase,
    LoginUseCase,
    BookSessionUseCase,

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
    SessionModule,
    ContractModule,

    // Queries
    UserQueryService,

    // UseCases
    RegisterUseCase,
    LoginUseCase,
    BookSessionUseCase,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,

    // Shared
    JwtStrategy,
    PassportModule,
  ],
})
export class ApplicationModule {}
