import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ProductService } from "@domains/catalog/product/services/product.service";

/**
 * Remove Product Item Command (Application Layer)
 * [从产品移除项目命令]
 *
 * 职责：
 * 1. 编排从产品移除项目用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回执行结果
 */
@Injectable()
export class RemoveProductItemCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行从产品移除项目用例
   * [Execute remove product item use case]
   *
   * @param itemId 项目ID
   * @returns 执行结果
   */
  async execute(itemId: string): Promise<void> {
    try {
      this.logger.debug(`Removing product item: ${itemId}`);
      await this.productService.removeItem(itemId);
      this.logger.debug(`Product item removed successfully: ${itemId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove product item: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
