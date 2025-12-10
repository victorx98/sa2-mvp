import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { IJwtUser } from "@shared/types/jwt-user.interface";

export const CurrentUser = createParamDecorator<IJwtUser>(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as IJwtUser;
  },
);
