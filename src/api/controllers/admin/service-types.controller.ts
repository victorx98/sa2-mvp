import { Controller, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";

/**
 * Admin Service Types Controller
 * [管理员服务类型控制器]
 *
 * 职责：
 * 1. 处理服务类型相关的HTTP请求
 * 2. 执行认证和授权
 * 3. 调用Application Layer的Query
 * 4. 返回HTTP响应
 */
@Controller("api/admin/service-types")
@ApiTags("Admin Service Types")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager")
export class AdminServiceTypesController {
  constructor() {}
}
