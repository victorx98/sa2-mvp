import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { ProductFilterDto } from '@domains/catalog/product/dto/product-filter.dto';
import { PaginationDto } from '@domains/catalog/common/dto/pagination.dto';
import { SortDto } from '@domains/catalog/common/dto/sort.dto';
import { PaginatedResult } from '@shared/types/paginated-result';
import { IProduct } from '@domains/catalog/product/interfaces/product.interface';

/**
 * Get Products Query (Application Layer)
 * [获取产品列表查询]
 * 
 * 职责：
 * 1. 编排产品列表查询用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回分页的产品列表
 */
@Injectable()
export class GetProductsQuery extends QueryBase {
  constructor(
    private readonly productService: ProductService,
  ) {
    super();
  }

  /**
   * 执行获取产品列表用例
   * [Execute get products use case]
   * 
   * @param filter 产品过滤条件
   * @param pagination 分页参数
   * @param sort 排序参数
   * @returns 分页的产品列表
   */
  async execute(
    filter: ProductFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IProduct>> {
    return this.withErrorHandling(async () => {
      this.logger.debug(`Getting products with filter: ${JSON.stringify(filter)}`);
      const products = await this.productService.search(filter, pagination, sort);
      this.logger.debug(`Products retrieved successfully: ${products.total} total`);
      return products;
    });
  }
}
