import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { UpdateProductDto } from '@domains/catalog/product/dto/update-product.dto';
import { IProduct } from '@domains/catalog/product/interfaces/product.interface';

/**
 * Update Product Command (Application Layer)
 * [更新产品命令]
 * 
 * 职责：
 * 1. 编排产品更新用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回更新后的产品
 */
@Injectable()
export class UpdateProductCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行更新产品用例
   * [Execute update product use case]
   * 
   * @param productId 产品ID
   * @param input 更新产品输入参数
   * @returns 更新后的产品
   */
  async execute(productId: string, input: UpdateProductDto): Promise<IProduct> {
    try {
      this.logger.debug(`Updating product: ${productId}`);
      const product = await this.productService.update(productId, input);
      this.logger.debug(`Product updated successfully: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(`Failed to update product: ${error.message}`, error.stack);
      throw error;
    }
  }
}
