import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { ApiPrefix } from '@api/api.constants';
import type { IJwtUser } from '@shared/types/jwt-user.interface';
import { plainToInstance } from 'class-transformer';
import { CreateJobCategoryCommand } from '@application/commands/preference/create-job-category.command';
import { UpdateJobCategoryCommand } from '@application/commands/preference/update-job-category.command';
import { DeleteJobCategoryCommand } from '@application/commands/preference/delete-job-category.command';
import { ListJobCategoriesUseCase } from '@application/queries/preference/use-cases/list-job-categories.use-case';
import { CreateJobCategoryDto } from '@api/dto/request/preference/create-job-category.dto';
import { UpdateJobCategoryDto } from '@api/dto/request/preference/update-job-category.dto';
import { JobCategoryQueryDto } from '@api/dto/request/preference/job-category-query.dto';
import {
  JobCategoryResponseDto,
  JobCategoryListResponseDto,
} from '@api/dto/response/preference/job-category.response.dto';

/**
 * API Layer - Job Categories Controller
 * 岗位类别控制器(Job Categories Controller)
 * 职责：
 * 1. 定义岗位类别相关的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 命令和查询
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags('Job Categories')
@Controller(`${ApiPrefix}/job-categories`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobCategoriesController {
  constructor(
    private readonly createJobCategoryCommand: CreateJobCategoryCommand,
    private readonly updateJobCategoryCommand: UpdateJobCategoryCommand,
    private readonly deleteJobCategoryCommand: DeleteJobCategoryCommand,
    private readonly listJobCategoriesQuery: ListJobCategoriesUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new job category' })
  @ApiCreatedResponse({
    description: 'Job category created successfully',
    type: JobCategoryResponseDto,
  })
  async create(
    @Body() dto: CreateJobCategoryDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobCategoryResponseDto> {
    const result = await this.createJobCategoryCommand.execute(dto, user.userId);
    return plainToInstance(JobCategoryResponseDto, result, {
      enableImplicitConversion: false,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List job categories with pagination and search' })
  @ApiOkResponse({
    description: 'Job categories retrieved successfully',
    type: JobCategoryListResponseDto,
  })
  async list(@Query() query: JobCategoryQueryDto): Promise<JobCategoryListResponseDto> {
    const result = await this.listJobCategoriesQuery.execute(query);
    return {
      data: plainToInstance(JobCategoryResponseDto, result.data, {
        enableImplicitConversion: false,
      }),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job category by ID' })
  @ApiParam({
    name: 'id',
    description: 'Job category ID',
    example: 'software_engineer',
  })
  @ApiOkResponse({
    description: 'Job category retrieved successfully',
    type: JobCategoryResponseDto,
  })
  async getById(@Param('id') id: string): Promise<JobCategoryResponseDto> {
    const result = await this.listJobCategoriesQuery.findById(id);
    return plainToInstance(JobCategoryResponseDto, result, {
      enableImplicitConversion: false,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a job category' })
  @ApiParam({
    name: 'id',
    description: 'Job category ID',
    example: 'software_engineer',
  })
  @ApiOkResponse({
    description: 'Job category updated successfully',
    type: JobCategoryResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateJobCategoryDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobCategoryResponseDto> {
    const result = await this.updateJobCategoryCommand.execute(id, dto, user.userId);
    return plainToInstance(JobCategoryResponseDto, result, {
      enableImplicitConversion: false,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a job category (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Job category ID',
    example: 'software_engineer',
  })
  @ApiOkResponse({
    description: 'Job category deleted successfully',
    type: JobCategoryResponseDto,
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobCategoryResponseDto> {
    const result = await this.deleteJobCategoryCommand.execute(id, user.userId);
    return plainToInstance(JobCategoryResponseDto, result, {
      enableImplicitConversion: false,
    });
  }
}

