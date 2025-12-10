import { Controller, Get, Query, UseGuards, HttpException, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { GetServiceTypesQuery } from "@application/queries/service-type/get-service-types.query";
import { ServiceTypeFilterDto } from "@domains/catalog/service-type/dto/service-type-filter.dto";
import { PaginationDto } from "@domains/catalog/common/dto/pagination.dto";
import { SortDto } from "@domains/catalog/common/dto/sort.dto";

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
  constructor(private readonly getServiceTypesQuery: GetServiceTypesQuery) {}

  @Get()
  @ApiOperation({ summary: "Get all service types" })
  @ApiResponse({
    status: 200,
    description: "Service types retrieved successfully",
  })
  async findAll(@Query() query: any) {
    // Extract filter, pagination, and sort parameters [提取筛选、分页和排序参数]
    const filter = query as ServiceTypeFilterDto;

    // Validate and provide defaults for pagination [验证分页参数并提供默认值]
    const page =
      query.page !== undefined &&
      query.page !== null &&
      !isNaN(Number(query.page))
        ? Number(query.page)
        : 1;
    const pageSize =
      query.pageSize !== undefined &&
      query.pageSize !== null &&
      !isNaN(Number(query.pageSize))
        ? Number(query.pageSize)
        : 20;

    if (page < 1 || pageSize < 1) {
      throw new HttpException(
        "Invalid pagination parameters. Page and pageSize must be positive integers.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const pagination = {
      page,
      pageSize,
    } as PaginationDto;
    const sort = {
      orderField: query.orderField || query.field, // Support both old and new parameter name for backward compatibility
      orderDirection: query.orderDirection || query.order, // Support both old and new parameter name for backward compatibility
    } as SortDto;

    return this.getServiceTypesQuery.execute(filter, pagination, sort);
  }
}
