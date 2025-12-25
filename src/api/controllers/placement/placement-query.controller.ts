/**
 * Placement Query Controller [岗位查询控制器]
 * Handles job query API requests [处理岗位查询API请求]
 */
import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QueryJobsUseCase } from '@application/queries/placement/use-cases/query-jobs.use-case';
import { QueryJobApplicationsUseCase } from '@application/queries/placement/use-cases/query-job-applications.use-case';
import { JobQueryDto } from '@api/dto/request/placement/placement-query.request.dto';
import { JobApplicationQueryDto } from '@api/dto/request/placement/job-application-query.request.dto';
import { JobQueryFilter } from '@application/queries/placement/dto/query-jobs.dto';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { JobQueryResponseDto, JobPositionResponseDto } from '@api/dto/response/placement/placement.response.dto';
import { JobApplicationQueryResponseDto } from '@api/dto/response/placement/job-application-query.response.dto';

@Controller('api/query/placement')
@ApiTags('Placement')
@ApiBearerAuth()
export class PlacementQueryController {
  private readonly logger = new Logger(PlacementQueryController.name);

  constructor(
    private readonly queryJobsUseCase: QueryJobsUseCase,
    private readonly queryJobApplicationsUseCase: QueryJobApplicationsUseCase,
  ) {}

  /**
   * Query jobs with pagination, filtering and sorting [带分页、筛选和排序的岗位查询]
   *
   * @param queryDto - Job query DTO [岗位查询DTO]
   * @returns Paginated job results [分页岗位结果]
   */
  @Get('jobs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Query jobs',
    description:
      'Queries recommended jobs with filter/pagination/sort. jobApplicationType is required. [带筛选/分页/排序查询推荐岗位，jobApplicationType必填]',
  })
  @ApiOkResponse({
    description: 'Job query completed successfully',
    type: JobQueryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }))
  async queryJobs(@Query() queryDto: JobQueryDto): Promise<JobQueryResponseDto> {
    this.logger.log(`Received job query request: ${JSON.stringify(queryDto)}`);

    try {
      // Build filter from query DTO [从查询DTO构建筛选条件]
      const filter: JobQueryFilter = this.buildFilterFromDto(queryDto);

      // Build pagination and sorting parameters [构建分页和排序参数]
      const pagination = {
        page: queryDto.page,
        pageSize: queryDto.pageSize,
      };

      const sort = {
        field: queryDto.sortField,
        direction: queryDto.sortDirection,
      };

      // Execute query [执行查询]
      const results = await this.queryJobsUseCase.execute({
        filter,
        pagination,
        sort,
      });

      this.logger.log(`Job query completed successfully, returned ${results.data.length} items out of ${results.total}`);

      // Map Read Model to API Response DTO
      // Convert Date objects to ISO strings
      const mappedItems = results.data.map((item) => {
        return {
          ...item,
          applicationDeadline: item.applicationDeadline instanceof Date
            ? item.applicationDeadline.toISOString()
            : item.applicationDeadline
              ? new Date(item.applicationDeadline).toISOString()
              : null,
          postDate: item.postDate instanceof Date ? item.postDate.toISOString() : item.postDate,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
          updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
        };
      });

      return {
        data: mappedItems as unknown as JobPositionResponseDto[],
        total: results.total,
        page: results.page,
        pageSize: results.pageSize,
        totalPages: results.totalPages,
      };
    } catch (error) {
      this.logger.error(`Job query failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Build filter from query DTO [从查询DTO构建筛选条件]
   *
   * @param queryDto - Job query DTO [岗位查询DTO]
   * @returns Job query filter [岗位查询筛选条件]
   */
  private buildFilterFromDto(queryDto: JobQueryDto): JobQueryFilter {
    // Required: job application type filter [必填：岗位投递类型筛选]
    const filter: JobQueryFilter = {
      jobApplicationType: queryDto.jobApplicationType,
    };

    // Basic filters [基础筛选]
    if (queryDto.location) {
      filter.location = queryDto.location;
    }

    if (queryDto.jobType) {
      filter.jobType = queryDto.jobType;
    }

    if (queryDto.level) {
      filter.level = queryDto.level;
    }

    if (queryDto.jobTitles && queryDto.jobTitles.length > 0) {
      filter.jobTitles = queryDto.jobTitles;
    }

    if (queryDto.keyword) {
      filter.keyword = queryDto.keyword;
    }

    if (queryDto.status) {
      filter.status = queryDto.status;
    }

    if (queryDto.h1b) {
      filter.h1b = queryDto.h1b;
    }

    if (queryDto.usCitizenship) {
      filter.usCitizenship = queryDto.usCitizenship;
    }

    // Date range filter [日期范围筛选]
    if (queryDto.startDate || queryDto.endDate) {
      filter.postDateRange = {};
      if (queryDto.startDate) {
        filter.postDateRange.start = new Date(queryDto.startDate);
      }
      if (queryDto.endDate) {
        filter.postDateRange.end = new Date(queryDto.endDate);
      }
    }

    return filter;
  }

  /**
   * Query job applications with pagination, filtering and sorting [带分页、筛选和排序的投递申请查询]
   *
   * @param queryDto - Job application query DTO [投递申请查询DTO]
   * @returns Paginated job application results [分页投递申请结果]
   */
  @Get('job-applications')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Query job applications',
    description:
      'Queries job applications with filter/pagination/sort. Returns applications with student, mentor, and counselor information. [带筛选/分页/排序查询投递申请，返回包含学生、导师、顾问信息]',
  })
  @ApiOkResponse({
    description: 'Job application query completed successfully',
    type: JobApplicationQueryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }))
  async queryJobApplications(@Query() queryDto: JobApplicationQueryDto): Promise<JobApplicationQueryResponseDto> {
    this.logger.log(`Received job application query request: ${JSON.stringify(queryDto)}`);

    try {
      // Build filter from query DTO [从查询DTO构建筛选条件]
      const filter = {
        status: queryDto.status,
        applicationType: queryDto.applicationType,
        studentId: queryDto.studentId,
        assignedMentorId: queryDto.assignedMentorId,
        recommendedBy: queryDto.recommendedBy,
        startDate: queryDto.startDate,
        endDate: queryDto.endDate,
      };

      // Build pagination and sorting parameters [构建分页和排序参数]
      const pagination = {
        page: queryDto.page,
        pageSize: queryDto.pageSize,
      };

      const sort = {
        field: queryDto.sortField,
        direction: queryDto.sortDirection,
      };

      // Execute query [执行查询]
      const results = await this.queryJobApplicationsUseCase.execute({
        filter,
        pagination,
        sort,
      });

      this.logger.log(`Job application query completed successfully, returned ${results.data.length} items out of ${results.total}`);

      return {
        data: results.data,
        total: results.total,
        page: results.page,
        pageSize: results.pageSize,
        totalPages: results.totalPages,
      };
    } catch (error) {
      this.logger.error(`Job application query failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}