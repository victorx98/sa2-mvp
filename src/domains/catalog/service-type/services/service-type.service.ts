import { Injectable } from "@nestjs/common";
import { ServiceTypeRepository } from "../service-type.repository";
import { PaginatedResult } from "@shared/types/paginated-result";
import { IServiceType } from "../interfaces/service-type.interface";

/**
 * Service Type Filter DTO [服务类型筛选DTO]
 */
interface ServiceTypeFilterDto {
  code?: string;
  name?: string;
  status?: string;
  includeDeleted?: boolean;
}

/**
 * Pagination DTO [分页DTO]
 */
interface PaginationDto {
  page?: number;
  pageSize?: number;
}

/**
 * Sort DTO [排序DTO]
 */
interface SortDto {
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Service Type Service [服务类型服务]
 * Handles business logic for service types
 * [处理服务类型的业务逻辑]
 */
@Injectable()
export class ServiceTypeService {
  constructor(private readonly serviceTypeRepository: ServiceTypeRepository) {}

  /**
   * Search service types with filter, pagination and sort
   * [根据筛选条件、分页和排序查询服务类型]
   *
   * @param filter Filter criteria [筛选条件]
   * @param pagination Pagination options [分页选项]
   * @param sort Sort options [排序选项]
   * @returns Paginated result of service types [服务类型的分页结果]
   */
  async search(
    filter: ServiceTypeFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IServiceType>> {
    // Get total count [获取总数量]
    const total = await this.serviceTypeRepository.count(filter);

    // Return empty result if total is 0 [如果总数为0，返回空结果]
    if (total === 0) {
      return {
        data: [],
        total: 0,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
        totalPages: 0,
      };
    }

    // Get service types with pagination and sort [获取带分页和排序的服务类型]
    const serviceTypes = await this.serviceTypeRepository.findMany(
      filter,
      pagination,
      sort,
    );

    // Calculate pagination info [计算分页信息]
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const totalPages = Math.ceil(total / pageSize);

    // Return paginated result [返回分页结果]
    return {
      data: serviceTypes as IServiceType[],
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
