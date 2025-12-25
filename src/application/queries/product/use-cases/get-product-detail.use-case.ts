/**
 * Get Product Detail Use Case
 * 产品详情查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IProductQueryRepository, PRODUCT_QUERY_REPOSITORY } from '../interfaces/product-query.repository.interface';
import { ProductDetailReadModel } from '../models/product-read.model';
import { GetProductDetailDto } from '../dto/product-query.dto';

@Injectable()
export class GetProductDetailUseCase {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY)
    private readonly productQueryRepository: IProductQueryRepository,
  ) {}

  async execute(dto: GetProductDetailDto): Promise<ProductDetailReadModel | null> {
    return this.productQueryRepository.getProductDetail(dto);
  }
}

