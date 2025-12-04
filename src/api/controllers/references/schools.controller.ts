import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { SchoolListQuery } from "@application/queries/school/school-list.query";
import { ApiPrefix } from "@api/api.constants";
import { SchoolResponseDto } from "@api/dto/response/school-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Schools Controller
 * 职责：
 * 1. 定义学校相关的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Schools")
@Controller(`${ApiPrefix}/schools`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchoolsController {
  constructor(
    private readonly schoolListQuery: SchoolListQuery,
  ) {}

  @Get()
  @ApiOperation({ summary: "Search schools by Chinese or English name" })
  @ApiQuery({
    name: "text",
    required: false,
    description: "Search keyword (searches in both Chinese and English names)",
    type: String,
  })
  @ApiOkResponse({
    description: "School list retrieved successfully",
    type: SchoolResponseDto,
    isArray: true,
  })
  async getSchools(
    @Query("text") text?: string,
  ): Promise<SchoolResponseDto[]> {
    const items = await this.schoolListQuery.search(text);
    return plainToInstance(SchoolResponseDto, items, {
      enableImplicitConversion: false,
    });
  }
}

