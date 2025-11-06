import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { AuthCommandService } from "./auth-command.service";
import { AuthController } from "@api/controllers/auth.controller";
import { JwtStrategy } from "@shared/guards/strategies/jwt.strategy";
import { UserRepository } from "@infrastructure/repositories/user.repository";
import { USER_REPOSITORY } from "@domains/identity/user/user-repository.interface";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRATION") || "24h",
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthCommandService,
    JwtStrategy,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [AuthCommandService, JwtStrategy, PassportModule],
})
export class AuthCommandModule {}
