import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import * as schema from "@infrastructure/database/schema";
import { AddProductItemDto } from "@api/dto/request/catalog/product.request.dto";
import { ProductStatus } from "@shared/types/catalog-enums";
import {
  CatalogException,
  CatalogNotFoundException,
} from "@domains/catalog/common/exceptions/catalog.exception";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

/**
 * Add Product Item Command (Application Layer)
 * [添加产品项命令]
 *
 * 职责：
 * 1. 编排向产品添加项用例
 * 2. 执行业务规则验证
 * 3. 管理事务
 * 4. 执行数据库操作
 */
@Injectable()
export class AddProductItemCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行向产品添加项用例
   * [Execute add product item use case]
   *
   * @param productId - 产品ID
   * @param dto - 添加产品项DTO
   * @returns 执行结果
   */
  async execute(productId: string, dto: AddProductItemDto): Promise<void> {
    this.logger.debug(`Adding item to product: ${productId}`);

    await this.db.transaction(async (tx) => {
      // 1. 检查产品是否存在且为草稿状态
      const [existing] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);

      if (!existing) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (existing.status !== ProductStatus.DRAFT) {
        throw new CatalogException("PRODUCT_NOT_DRAFT");
      }

      // 2. 验证serviceTypeId格式和数量
      await this.validateProductItemReferences(
        [{ serviceTypeId: dto.serviceTypeId }],
        tx,
      );
      this.validateProductItemQuantities([
        { quantity: dto.quantity },
      ]);

      // 3. 检查重复
      const existingItem = await tx
        .select({ id: schema.productItems.id })
        .from(schema.productItems)
        .where(
          and(
            eq(schema.productItems.productId, productId),
            eq(schema.productItems.serviceTypeId, dto.serviceTypeId),
          ),
        )
        .limit(1);

      if (existingItem.length > 0) {
        throw new CatalogException("ITEM_ALREADY_IN_PRODUCT");
      }

      // 4. 插入产品项
      await tx.insert(schema.productItems).values({
        productId,
        serviceTypeId: dto.serviceTypeId,
        quantity: dto.quantity,
        sortOrder: dto.sortOrder ?? 0,
      });
    });

    this.logger.debug(`Item added to product successfully: ${productId}`);
  }

  /**
   * 验证产品项引用
   * [Validate product item references]
   */
  private async validateProductItemReferences(
    items: Array<{ serviceTypeId: string }>,
    tx?: any,
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const db = tx || this.db;
    const serviceTypeIds = items.map((item) => item.serviceTypeId);
    const uniqueIds = [...new Set(serviceTypeIds)];

    // 验证UUID格式
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const id of uniqueIds) {
      if (!uuidRegex.test(id)) {
        throw new CatalogException("INVALID_SERVICE_TYPE_ID", `Invalid format: ${id}`);
      }
    }
  }

  /**
   * 验证产品项数量
   * [Validate product item quantities]
   */
  private validateProductItemQuantities(items: Array<{ quantity: number }>): void {
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new CatalogException("INVALID_QUANTITY");
      }
    }
  }
}
