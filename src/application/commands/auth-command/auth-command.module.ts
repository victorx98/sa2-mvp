import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import type { StringValue } from "ms";
import { AuthCommandService } from "./auth-command.service";
import { AuthController } from "@api/controllers/auth.controller";
import { JwtStrategy } from "@shared/guards/strategies/jwt.strategy";
import { UserModule } from "@domains/identity/user/user.module";

@Module({
  imports: [
    UserModule, // Domain层：User (Identity)
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
  controllers: [AuthController],
  providers: [AuthCommandService, JwtStrategy],
  exports: [AuthCommandService, JwtStrategy, PassportModule],
})
export class AuthCommandModule {}
