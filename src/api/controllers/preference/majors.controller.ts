import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { MajorListUseCase } from "@application/queries/identity/use-cases/major-list.use-case";
import { ApiPrefix } from "@api/api.constants";
import { MajorResponseDto } from "@api/dto/response/preference/major-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Majors Controller
 * 职责：
 * 1. 定义专业相关的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Majors")
@Controller(`${ApiPrefix}/majors`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MajorsController {
  constructor(
    private readonly majorListQuery: MajorListUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "Search majors by Chinese or English name" })
  @ApiQuery({
    name: "text",
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
    @Query("text") text?: string,
  ): Promise<MajorResponseDto[]> {
    const items = await this.majorListQuery.listMajors({ keyword: text });
    return plainToInstance(MajorResponseDto, items.data, {
      enableImplicitConversion: false,
    });
  }
}

