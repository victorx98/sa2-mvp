import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { FindOneProductDto } from '@domains/catalog/product/dto/find-one-product.dto';
import { IProductDetail } from '@domains/catalog/product/interfaces';

/**
 * Get Product Query (Application Layer)
 * [获取产品查询]
 * 
 * 职责：
 * 1. 编排获取产品详情用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回产品详情
 */
@Injectable()
export class GetProductQuery extends QueryBase {
  constructor(
    private readonly productService: ProductService,
  ) {
    super();
  }

  /**
   * 执行获取产品详情用例
   * [Execute get product detail use case]
   * 
   * @param input 查询产品输入参数
   * @returns 产品详情
   */
  async execute(input: FindOneProductDto): Promise<IProductDetail | null> {
    return this.withErrorHandling(async () => {
      this.logger.debug(`Getting product: ${input.id || input.code}`);
      const product = await this.productService.findOne(input);
      this.logger.debug(`Product retrieved successfully: ${product?.id || 'not found'}`);
      return product;
    });
  }
}
