import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { ApiPrefix } from "@api/api.constants";
import { CounselorListUseCase } from "@application/queries/identity/use-cases/counselor-list.use-case";
import { CounselorSummaryResponseDto } from "@api/dto/response/counselor-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Counselors Controller
 * 职责：
 * 1. 定义顾问列表相关的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Counselors")
@Controller(`${ApiPrefix}/counselors`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CounselorsController {
  constructor(private readonly counselorListQuery: CounselorListUseCase) { }

  @Get("find")
  @ApiOperation({ summary: "find counselor" })
  @ApiQuery({
    name: "text",
    required: false,
    description: "Search keyword to filter counselors (searches in email, English name, and Chinese name)",
    type: String,
  })
  @ApiOkResponse({
    description: "Counselor results retrieved successfully",
    type: CounselorSummaryResponseDto,
    isArray: true,
  })
  async findCounselors(
    @Query("text") text?: string,
  ): Promise<CounselorSummaryResponseDto[]> {
    const counselors = await this.counselorListQuery.listCounselors({ keyword: text });
    return plainToInstance(CounselorSummaryResponseDto, counselors.data, {
      enableImplicitConversion: false,
    });
  }
}

