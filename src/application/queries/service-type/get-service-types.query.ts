import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { ServiceTypeService } from '@domains/catalog/service-type/services/service-type.service';
import { ServiceTypeFilterDto } from '@domains/catalog/service-type/dto/service-type-filter.dto';
import { PaginationDto } from '@domains/catalog/common/dto/pagination.dto';
import { SortDto } from '@domains/catalog/common/dto/sort.dto';
import { PaginatedResult } from '@shared/types/paginated-result';
import { IServiceType } from '@domains/catalog/service-type/interfaces/service-type.interface';

/**
 * Get Service Types Query (Application Layer)
 * [获取服务类型列表查询]
 * 
 * 职责：
 * 1. 编排服务类型列表查询用例
 * 2. 调用 Catalog Domain 的 Service Type Service
 * 3. 返回分页的服务类型列表
 */
@Injectable()
export class GetServiceTypesQuery extends QueryBase {
  constructor(
    private readonly serviceTypeService: ServiceTypeService,
  ) {
    super();
  }

  /**
   * 执行获取服务类型列表用例
   * [Execute get service types use case]
   * 
   * @param filter 服务类型过滤条件
   * @param pagination 分页参数
   * @param sort 排序参数
   * @returns 分页的服务类型列表
   */
  async execute(
    filter: ServiceTypeFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IServiceType>> {
    return this.withErrorHandling(async () => {
      this.logger.debug(`Getting service types with filter: ${JSON.stringify(filter)}`);
      const serviceTypes = await this.serviceTypeService.search(filter, pagination, sort);
      this.logger.debug(`Service types retrieved successfully: ${serviceTypes.total} total`);
      return serviceTypes;
    });
  }
}
