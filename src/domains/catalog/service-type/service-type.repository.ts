import { Injectable, Inject } from '@nestjs/common';
import { eq, like, ne, and, sql, count, asc, desc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { DrizzleDatabase } from '@shared/types/database.types';
import { serviceTypes } from '@infrastructure/database/schema/service-types.schema';
import { ServiceTypeFilterDto } from './dto/service-type-filter.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { SortDto } from '../common/dto/sort.dto';
import { ServiceType } from '@infrastructure/database/schema/service-types.schema';
import { buildLikePattern } from '../common/utils/sql.utils';

/**
 * Service Type Repository [服务类型仓库]
 * Handles database operations for service types
 * [处理服务类型的数据库操作]
 */
@Injectable()
export class ServiceTypeRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get order by clause for service types
   * [获取服务类型的排序子句]
   */
  private getOrderBy(sort?: SortDto) {
    const orderField = sort?.orderField || 'createdAt'; // Use new parameter name, default to createdAt
    const orderDirection = sort?.orderDirection || 'desc'; // Use new parameter name, default to desc

    // Return appropriate order by clause directly [直接返回适当的排序子句]
    switch (orderField) {
      case 'id':
        return orderDirection === 'asc' ? serviceTypes.id : sql`${serviceTypes.id} DESC`;
      case 'code':
        return orderDirection === 'asc' ? serviceTypes.code : sql`${serviceTypes.code} DESC`;
      case 'name':
        return orderDirection === 'asc' ? serviceTypes.name : sql`${serviceTypes.name} DESC`;
      case 'status':
        return orderDirection === 'asc' ? serviceTypes.status : sql`${serviceTypes.status} DESC`;
      case 'updatedAt':
        return orderDirection === 'asc' ? serviceTypes.updatedAt : sql`${serviceTypes.updatedAt} DESC`;
      case 'createdAt':
      default:
        return orderDirection === 'asc' ? serviceTypes.createdAt : sql`${serviceTypes.createdAt} DESC`;
    }
  }

  /**
   * Find many service types with filter, pagination and sort
   * [根据筛选条件、分页和排序查询多个服务类型]
   * 
   * @param filter Filter criteria [筛选条件]
   * @param pagination Pagination options [分页选项]
   * @param sort Sort options [排序选项]
   * @returns Array of service types [服务类型数组]
   */
  async findMany(
    filter: ServiceTypeFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<ServiceType[]> {
    // Build where conditions [构建查询条件]
    const conditions = [];

    // Exclude deleted status by default [默认排除已删除状态]
    if (!filter.includeDeleted) {
      conditions.push(ne(serviceTypes.status, 'DELETED'));
    }

    // Filter by code [按编码筛选]
    if (filter.code) {
      conditions.push(like(serviceTypes.code, buildLikePattern(filter.code)));
    }

    // Filter by name [按名称筛选]
    if (filter.name) {
      conditions.push(like(serviceTypes.name, buildLikePattern(filter.name)));
    }

    // Filter by status [按状态筛选]
    if (filter.status) {
      conditions.push(eq(serviceTypes.status, filter.status));
    }

    // Execute query with all conditions [执行包含所有条件的查询]
    return this.db.select()
      .from(serviceTypes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(this.getOrderBy(sort))
      .limit(pagination?.pageSize)
      .offset(pagination ? (pagination.page - 1) * pagination.pageSize : 0)
      .execute();
  }

  /**
   * Count service types with filter
   * [根据筛选条件统计服务类型数量]
   * 
   * @param filter Filter criteria [筛选条件]
   * @returns Number of matching service types [匹配的服务类型数量]
   */
  async count(filter: ServiceTypeFilterDto): Promise<number> {
    // Build where conditions [构建查询条件]
    const conditions = [];

    // Exclude deleted status by default [默认排除已删除状态]
    if (!filter.includeDeleted) {
      conditions.push(ne(serviceTypes.status, 'DELETED'));
    }

    // Filter by code [按编码筛选]
    if (filter.code) {
      conditions.push(like(serviceTypes.code, buildLikePattern(filter.code)));
    }

    // Filter by name [按名称筛选]
    if (filter.name) {
      conditions.push(like(serviceTypes.name, buildLikePattern(filter.name)));
    }

    // Filter by status [按状态筛选]
    if (filter.status) {
      conditions.push(eq(serviceTypes.status, filter.status));
    }

    // Execute count query [执行计数查询]
    const result = await this.db
      .select({ total: count() })
      .from(serviceTypes)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0].total);
  }
}
