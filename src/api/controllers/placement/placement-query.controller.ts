/**
 * Placement Query Controller [岗位查询控制器]
 * Handles job query API requests [处理岗位查询API请求]
 */
import { Controller, Get, Query, UsePipes, ValidationPipe, Logger, Inject, UseGuards } from '@nestjs/common';
import { PlacementQueryService } from '@domains/query/placement/placement-query.service';
import { JobQueryDto } from '@api/dto/request/placement-query.request.dto';
import { IJobQueryFilter } from '@domains/query/placement/dto/placement-query.dto';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';

@Controller('query/placement')
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
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }))
  async queryJobs(@Query() queryDto: JobQueryDto) {
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

      return {
        success: true,
        data: results,
        message: 'Job query completed successfully',
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
    const filter: IJobQueryFilter = {};

    // Basic filters [基础筛选]
    if (queryDto.locations && queryDto.locations.length > 0) {
      filter.locations = queryDto.locations;
    }

    if (queryDto.jobTypes && queryDto.jobTypes.length > 0) {
      filter.jobTypes = queryDto.jobTypes;
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

    if (queryDto.jobApplicationTypes && queryDto.jobApplicationTypes.length > 0) {
      filter.jobApplicationTypes = queryDto.jobApplicationTypes;
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