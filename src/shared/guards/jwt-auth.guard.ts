import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import {
  SupabaseAuthException,
  SupabaseAuthService,
  SupabaseAuthUser,
} from "@infrastructure/auth/supabase-auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    const authUser = await this.getSupabaseUser(token);
    const user = await this.userService.findByIdWithRoles(authUser.id);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.status && user.status !== "active") {
      throw new UnauthorizedException("User account is not active");
    }

    request.user = {
      ...user,
      email: user.email || authUser.email || "",
      roles: user.roles ?? [],
    };

    (request as unknown as Record<string, unknown>).authUser = authUser;

    return true;
  }

  private extractTokenFromRequest(request: Request): string | null {
    const authorization =
      request.headers.authorization || request.headers.Authorization;

    if (!authorization || Array.isArray(authorization)) {
      return null;
    }

    const [type, token] = authorization.trim().split(" ");
    if (!token || type.toLowerCase() !== "bearer") {
      return null;
    }

    return token;
  }

  private async getSupabaseUser(token: string): Promise<SupabaseAuthUser> {
    try {
      return await this.supabaseAuthService.getUserByToken(token);
    } catch (error) {
      if (error instanceof SupabaseAuthException) {
        throw new UnauthorizedException("Invalid access token");
      }
      throw error;
    }
  }
}
