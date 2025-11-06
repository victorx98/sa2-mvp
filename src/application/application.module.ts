import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Domain Layer
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { USER_REPOSITORY } from '@domains/identity/user/user-repository.interface';

// Application Layer - Queries
import { UserQueryService } from './queries/user-query.service';

// Application Layer - UseCases
import { RegisterUseCase } from './use-cases/auth/register.use-case';
import { LoginUseCase } from './use-cases/auth/login.use-case';

// Application Layer - Commands (兼容层)
import { AuthCommandService } from './commands/auth-command/auth-command.service';

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

    // Queries
    UserQueryService,

    // UseCases
    RegisterUseCase,
    LoginUseCase,

    // Commands (兼容层)
    AuthCommandService,

    // Shared
    JwtStrategy,
  ],
  exports: [
    // Queries
    UserQueryService,

    // UseCases
    RegisterUseCase,
    LoginUseCase,

    // Commands (兼容层 - 保持向后兼容)
    AuthCommandService,

    // Shared
    JwtStrategy,
    PassportModule,
  ],
})
export class ApplicationModule {}
