import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "@shared/decorators/roles.decorator";

/**
 * 角色守卫
 * 检查用户是否具有访问路由所需的角色
 *
 * 使用方式：
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('counselor')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 获取路由所需的角色列表
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 获取当前用户
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 检查用户是否存在
    if (!user) {
      throw new ForbiddenException("User context is missing");
    }

    const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access requires one of the roles: ${requiredRoles.join(
          ", ",
        )}. Current roles: ${
          userRoles.length > 0 ? userRoles.join(", ") : "none"
        }`,
      );
    }

    return true;
  }
}
