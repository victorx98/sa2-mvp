import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ProductService } from "@domains/catalog/product/services/product.service";
import { IProduct } from "@domains/catalog/product/interfaces/product.interface";
import { ProductStatus } from "@shared/types/catalog-enums";

/**
 * Update Product Status Command (Application Layer)
 * [更新产品状态命令]
 *
 * 职责：
 * 1. 编排产品状态更新用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回更新后的产品
 */
@Injectable()
export class UpdateProductStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行更新产品状态用例
   * [Execute update product status use case]
   *
   * @param productId 产品ID
   * @param targetStatus 目标状态
   * @returns 更新后的产品
   */
  async execute(
    productId: string,
    targetStatus: ProductStatus,
  ): Promise<IProduct> {
    try {
      this.logger.debug(
        `Updating product status: ${productId} -> ${targetStatus}`,
      );
      const product = await this.productService.updateStatus(
        productId,
        targetStatus,
      );
      this.logger.debug(
        `Product status updated successfully: ${product.id} -> ${product.status}`,
      );
      return product;
    } catch (error) {
      this.logger.error(
        `Failed to update product status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
