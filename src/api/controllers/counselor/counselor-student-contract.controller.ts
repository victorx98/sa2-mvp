import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { ApiPrefix } from "@api/api.constants";
import { GetServiceBalanceDto } from "@api/dto/request/get-service-balance.dto";
import { ServiceBalanceResponseDto } from "@api/dto/response/service-balance-response.dto";
import { ServiceBalanceQuery } from "@application/queries/contract/service-balance.query";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Counselor Student Contract Controller
 * 职责：
 * 1. 定义 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 * ❌ 不进行数据转换（由 Application Layer 负责）
 */
@ApiTags("Counselor Portal")
@Controller(`${ApiPrefix}/student/contract`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("counselor")
export class CounselorStudentContractController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly serviceBalanceQuery: ServiceBalanceQuery,
  ) {}

  @Get("getServiceBalance")
  @ApiOperation({ summary: "Get service balance for a student" })
  @ApiOkResponse({
    description: "Service balance retrieved successfully",
    type: ServiceBalanceResponseDto,
    isArray: true,
  })
  async getServiceBalance(
    @Query() query: GetServiceBalanceDto,
  ): Promise<ServiceBalanceResponseDto[]> {
    const items = await this.serviceBalanceQuery.getServiceBalance(
      query.studentId,
      query.serviceType,
    );
    return plainToInstance(ServiceBalanceResponseDto, items, {
      enableImplicitConversion: false,
    });
  }
}

