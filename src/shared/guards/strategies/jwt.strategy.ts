import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthCommandService } from "@application/commands/auth-command/auth-command.service";
import { IJwtPayload, IJwtUser } from "@shared/types/jwt-user.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authCommandService: AuthCommandService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: IJwtPayload): Promise<IJwtUser> {
    const user = await this.authCommandService.validateUser(payload.sub);
    return { userId: payload.sub, email: payload.email, ...user };
  }
}
