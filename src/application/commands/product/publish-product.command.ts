import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { IProduct } from '@domains/catalog/product/interfaces/product.interface';

/**
 * Publish Product Command (Application Layer)
 * [发布产品命令]
 * 
 * 职责：
 * 1. 编排产品发布用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回发布后的产品
 */
@Injectable()
export class PublishProductCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行发布产品用例
   * [Execute publish product use case]
   * 
   * @param productId 产品ID
   * @returns 发布后的产品
   */
  async execute(productId: string): Promise<IProduct> {
    try {
      this.logger.debug(`Publishing product: ${productId}`);
      const product = await this.productService.publish(productId);
      this.logger.debug(`Product published successfully: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(`Failed to publish product: ${error.message}`, error.stack);
      throw error;
    }
  }
}
