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
import { CreateJobTitleCommand } from '@application/commands/preference/create-job-title.command';
import { UpdateJobTitleCommand } from '@application/commands/preference/update-job-title.command';
import { DeleteJobTitleCommand } from '@application/commands/preference/delete-job-title.command';
import { ListJobTitlesQuery } from '@application/queries/preference/list-job-titles.query';
import { CreateJobTitleDto } from '@api/dto/request/preference/create-job-title.dto';
import { UpdateJobTitleDto } from '@api/dto/request/preference/update-job-title.dto';
import { JobTitleQueryDto } from '@api/dto/request/preference/job-title-query.dto';
import {
  JobTitleResponseDto,
  JobTitleListResponseDto,
} from '@api/dto/response/preference/job-title.response.dto';

/**
 * API Layer - Job Titles Controller
 * 岗位名称控制器(Job Titles Controller)
 * 职责：
 * 1. 定义岗位名称相关的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 命令和查询
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags('Job Titles')
@Controller(`${ApiPrefix}/job-titles`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobTitlesController {
  constructor(
    private readonly createJobTitleCommand: CreateJobTitleCommand,
    private readonly updateJobTitleCommand: UpdateJobTitleCommand,
    private readonly deleteJobTitleCommand: DeleteJobTitleCommand,
    private readonly listJobTitlesQuery: ListJobTitlesQuery,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new job title' })
  @ApiCreatedResponse({
    description: 'Job title created successfully',
    type: JobTitleResponseDto,
  })
  async create(
    @Body() dto: CreateJobTitleDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobTitleResponseDto> {
    const result = await this.createJobTitleCommand.execute(dto, user.userId);
    return plainToInstance(JobTitleResponseDto, result, {
      enableImplicitConversion: false,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List job titles with pagination and search' })
  @ApiOkResponse({
    description: 'Job titles retrieved successfully',
    type: JobTitleListResponseDto,
  })
  async list(@Query() query: JobTitleQueryDto): Promise<JobTitleListResponseDto> {
    const result = await this.listJobTitlesQuery.execute(query);
    return {
      data: plainToInstance(JobTitleResponseDto, result.data, {
        enableImplicitConversion: false,
      }),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job title by ID' })
  @ApiParam({
    name: 'id',
    description: 'Job title ID',
    example: 'senior_software_engineer',
  })
  @ApiOkResponse({
    description: 'Job title retrieved successfully',
    type: JobTitleResponseDto,
  })
  async getById(@Param('id') id: string): Promise<JobTitleResponseDto> {
    const result = await this.listJobTitlesQuery.findById(id);
    return plainToInstance(JobTitleResponseDto, result, {
      enableImplicitConversion: false,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a job title' })
  @ApiParam({
    name: 'id',
    description: 'Job title ID',
    example: 'senior_software_engineer',
  })
  @ApiOkResponse({
    description: 'Job title updated successfully',
    type: JobTitleResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateJobTitleDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobTitleResponseDto> {
    const result = await this.updateJobTitleCommand.execute(id, dto, user.userId);
    return plainToInstance(JobTitleResponseDto, result, {
      enableImplicitConversion: false,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a job title (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Job title ID',
    example: 'senior_software_engineer',
  })
  @ApiOkResponse({
    description: 'Job title deleted successfully',
    type: JobTitleResponseDto,
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobTitleResponseDto> {
    const result = await this.deleteJobTitleCommand.execute(id, user.userId);
    return plainToInstance(JobTitleResponseDto, result, {
      enableImplicitConversion: false,
    });
  }
}

