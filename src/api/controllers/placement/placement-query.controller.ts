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
  Inject,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlacementQueryService } from '@domains/query/placement/placement-query.service';
import { JobQueryDto } from '@api/dto/request/placement-query.request.dto';
import { IJobQueryFilter } from '@domains/query/placement/dto/placement-query.dto';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { JobQueryResponseDto, JobPositionResponseDto } from '@api/dto/response/placement/placement.response.dto';

@Controller('api/query/placement')
@ApiTags('Placement')
@ApiBearerAuth()
export class PlacementQueryController {
  private readonly logger = new Logger(PlacementQueryController.name);

  constructor(
    @Inject(PlacementQueryService)
    private readonly placementQueryService: PlacementQueryService,
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
      const filter: IJobQueryFilter = this.buildFilterFromDto(queryDto);

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
      const results = await this.placementQueryService.queryJobs(filter, pagination, sort);

      this.logger.log(`Job query completed successfully, returned ${results.items.length} items out of ${results.total}`);

      // Map DB column application_deadline to API field application_deadline
      // [将数据库列application_deadline映射到接口字段application_deadline]
      const mappedItems = (results.items as Array<Record<string, unknown>>).map(
        (item) => {
          const { applicationDeadline, ...rest } = item as {
            applicationDeadline?: Date | string | null;
            [key: string]: unknown;
          };

          const deadline =
            applicationDeadline instanceof Date
              ? applicationDeadline.toISOString()
              : typeof applicationDeadline === "string"
                ? applicationDeadline
                : null;

          return {
            ...rest,
            application_deadline: deadline,
          };
        },
      );

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
  private buildFilterFromDto(queryDto: JobQueryDto): IJobQueryFilter {
    // Required: job application type filter [必填：岗位投递类型筛选]
    const filter: IJobQueryFilter = {
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
}