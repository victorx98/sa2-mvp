import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ProductService } from '@domains/catalog/product/services/product.service';

/**
 * Update Product Item Sort Order Command (Application Layer)
 * [更新产品项目排序顺序命令]
 * 
 * 职责：
 * 1. 编排更新产品项目排序顺序用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回执行结果
 */
@Injectable()
export class UpdateProductItemSortOrderCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行更新产品项目排序顺序用例
   * [Execute update product item sort order use case]
   * 
   * @param items 项目排序信息
   * @returns 执行结果
   */
  async execute(items: Array<{ itemId: string; sortOrder: number }>): Promise<void> {
    try {
      this.logger.debug(`Updating product item sort order for ${items.length} items`);
      await this.productService.updateItemSortOrder(items);
      this.logger.debug(`Product item sort order updated successfully`);
    } catch (error) {
      this.logger.error(`Failed to update product item sort order: ${error.message}`, error.stack);
      throw error;
    }
  }
}