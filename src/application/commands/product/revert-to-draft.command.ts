import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { IProduct } from '@domains/catalog/product/interfaces/product.interface';

/**
 * Revert to Draft Product Command (Application Layer)
 * [恢复为草稿产品命令]
 * 
 * 职责：
 * 1. 编排产品恢复为草稿用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回恢复为草稿后的产品
 */
@Injectable()
export class RevertToDraftProductCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行恢复为草稿产品用例
   * [Execute revert to draft product use case]
   * 
   * @param productId 产品ID
   * @returns 恢复为草稿后的产品
   */
  async execute(productId: string): Promise<IProduct> {
    try {
      this.logger.debug(`Reverting product to draft: ${productId}`);
      const product = await this.productService.revertToDraft(productId);
      this.logger.debug(`Product reverted to draft successfully: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(`Failed to revert product to draft: ${error.message}`, error.stack);
      throw error;
    }
  }
}