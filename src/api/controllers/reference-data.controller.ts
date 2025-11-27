import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { SchoolListQuery } from "@application/queries/school/school-list.query";
import { MajorListQuery } from "@application/queries/major/major-list.query";
import { ApiPrefix } from "@api/api.constants";
import { SchoolResponseDto } from "@api/dto/response/school-response.dto";
import { MajorResponseDto } from "@api/dto/response/major-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Reference Data Controller
 * 职责：
 * 1. 定义参考数据的 HTTP 路由（学校、专业等）
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Reference Data")
@Controller(`${ApiPrefix}/reference`)
@UseGuards(JwtAuthGuard)
export class ReferenceDataController {
  constructor(
    private readonly schoolListQuery: SchoolListQuery,
    private readonly majorListQuery: MajorListQuery,
  ) {}

  @Get("schools")
  @ApiOperation({ summary: "Search schools by Chinese or English name" })
  @ApiQuery({
    name: "search",
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
    @Query("search") search?: string,
  ): Promise<SchoolResponseDto[]> {
    const items = await this.schoolListQuery.search(search);
    return plainToInstance(SchoolResponseDto, items, {
      enableImplicitConversion: false,
    });
  }

  @Get("majors")
  @ApiOperation({ summary: "Search majors by Chinese or English name" })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search keyword (searches in both Chinese and English names)",
    type: String,
  })
  @ApiOkResponse({
    description: "Major list retrieved successfully",
    type: MajorResponseDto,
    isArray: true,
  })
  async getMajors(
    @Query("search") search?: string,
  ): Promise<MajorResponseDto[]> {
    const items = await this.majorListQuery.search(search);
    return plainToInstance(MajorResponseDto, items, {
      enableImplicitConversion: false,
    });
  }
}

