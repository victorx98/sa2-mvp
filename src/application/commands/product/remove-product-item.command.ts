import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import * as schema from "@infrastructure/database/schema";
import { ProductStatus } from "@shared/types/catalog-enums";
import {
  CatalogException,
  CatalogNotFoundException,
} from "@domains/catalog/common/exceptions/catalog.exception";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

/**
 * Remove Product Item Command (Application Layer)
 * [移除产品项命令]
 *
 * 职责：
 * 1. 编排从产品中移除项的用例
 * 2. 执行业务规则验证（产品状态、最少项数）
 * 3. 管理事务
 * 4. 执行数据库操作
 */
@Injectable()
export class RemoveProductItemCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行移除产品项用例
   * [Execute remove product item use case]
   *
   * @param itemId 项目ID
   * @returns void
   */
  async execute(itemId: string): Promise<void> {
    this.logger.debug(`Removing product item: ${itemId}`);

    await this.db.transaction(async (tx) => {
      // 1. 查找产品项并获取productId
      const [productItem] = await tx
        .select({ productId: schema.productItems.productId })
        .from(schema.productItems)
        .where(eq(schema.productItems.id, itemId))
        .limit(1);

      if (!productItem) {
        throw new CatalogNotFoundException("PRODUCT_ITEM_NOT_FOUND");
      }

      const productId = productItem.productId;

      // 2. 检查产品是否存在且为草稿状态
      const [product] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);

      if (!product) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (product.status !== ProductStatus.DRAFT) {
        throw new CatalogException("PRODUCT_NOT_DRAFT");
      }

      // 3. 验证移除后至少保留1个项
      const items = await tx
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, productId));

      if (items.length <= 1) {
        throw new CatalogException("PRODUCT_MIN_ITEMS");
      }

      // 4. 删除产品项
      await tx.delete(schema.productItems).where(eq(schema.productItems.id, itemId));
    });

    this.logger.debug(`Product item removed successfully: ${itemId}`);
  }
}
