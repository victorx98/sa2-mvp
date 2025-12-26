/**
 * Search Products Use Case
 * 产品搜索查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IProductQueryRepository, PRODUCT_QUERY_REPOSITORY } from '../interfaces/product-query.repository.interface';
import { ProductReadModel } from '../models/product-read.model';
import { SearchProductsDto } from '../dto/product-query.dto';

@Injectable()
export class SearchProductsUseCase {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY)
    private readonly productQueryRepository: IProductQueryRepository,
  ) {}

  async execute(dto: SearchProductsDto): Promise<IPaginatedResult<ProductReadModel>> {
    return this.productQueryRepository.searchProducts(dto);
  }
}

