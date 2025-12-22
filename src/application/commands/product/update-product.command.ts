import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, inArray, count } from "drizzle-orm";
import type { DrizzleDatabase, DrizzleTransaction } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { UpdateProductDto } from "@api/dto/request/catalog/product.request.dto";
import { IProduct, IProductItem } from "@domains/catalog/product/interfaces";
import { ProductStatus } from "@shared/types/catalog-enums";
import { Currency } from "@shared/types/catalog-enums";
import * as schema from "@infrastructure/database/schema";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogGoneException,
} from "@domains/catalog/common/exceptions/catalog.exception";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

/**
 * Update Product Command (Application Layer)
 * [更新产品命令]
 *
 * 职责：
 * 1. 编排产品更新用例
 * 2. 执行业务规则验证
 * 3. 管理事务
 * 4. 处理产品项增删改和排序
 */
@Injectable()
export class UpdateProductCommand extends CommandBase {
  private readonly DEFAULT_SORT_FIELD = "createdAt";
  private readonly DEFAULT_SORT_ORDER = "desc";

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行更新产品用例
   * [Execute update product use case]
   *
   * @param productId 产品ID
   * @param input 更新产品输入参数
   * @param userId 当前用户ID
   * @returns 更新后的产品
   */
  async execute(
    productId: string,
    input: UpdateProductDto,
    userId: string,
  ): Promise<IProduct> {
    this.logger.debug(`Updating product: ${productId}`);

    // Use transaction to ensure atomicity for all operations [使用事务确保所有操作的原子性]
    const updatedProduct = await this.db.transaction(async (tx) => {
      // 1. Check if product exists and is draft [检查产品是否存在且为草稿状态]
      const [existing] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);

      if (!existing) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (existing.status === ProductStatus.DELETED) {
        throw new CatalogGoneException("PRODUCT_DELETED");
      }

      // 2. Can only update draft products [只能更新草稿状态的产品]
      if (existing.status !== ProductStatus.DRAFT) {
        throw new CatalogException("PRODUCT_NOT_DRAFT");
      }

      // 3. Validate price [验证价格]
      if (input.price !== undefined && input.price <= 0) {
        throw new CatalogException("INVALID_PRICE");
      }

      // 4. Validate coverImage format [验证封面图片格式]
      if (input.coverImage) {
        this.validateCoverImageFormat(input.coverImage);
      }

      // 5. Update product basic information [更新产品基本信息]
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.coverImage !== undefined) updateData.coverImage = input.coverImage;
      if (input.price !== undefined) updateData.price = input.price.toString();
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.targetUserPersonas !== undefined) {
        updateData.targetUserPersona = input.targetUserPersonas;
      }
      if (input.marketingLabels !== undefined) {
        updateData.marketingLabels = input.marketingLabels;
      }
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      const [updated] = await tx
        .update(schema.products)
        .set(updateData)
        .where(eq(schema.products.id, productId))
        .returning();

      // 6. Handle product item operations [处理产品项操作]

      // 6.1 Add new items if provided [添加新项]
      if (input.addItems && input.addItems.length > 0) {
        await this.handleAddItems(tx, productId, input.addItems, userId);
      }

      // 6.2 Remove items if provided [删除项]
      if (input.removeItems && input.removeItems.length > 0) {
        await this.handleRemoveItems(tx, productId, input.removeItems);
      }

      // 6.3 Sort items if provided [排序项]
      if (input.sortItems && input.sortItems.length > 0) {
        await this.handleSortItems(tx, productId, input.sortItems);
      }

      return updated;
    });

    // Get product items to include in response [获取产品项]
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId))
      .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

    this.logger.debug(`Product updated successfully: ${productId}`);

    return {
      ...this.mapToProductInterface(updatedProduct),
      items: this.safeArrayCast(items).map(this.mapToProductItemInterface.bind(this)),
    };
  }

  /**
   * 处理添加产品项
   * [Handle adding product items]
   */
  private async handleAddItems(
    tx: DrizzleTransaction,
    productId: string,
    items: Array<{ serviceTypeId: string; quantity: number; sortOrder?: number }>,
    userId: string,
  ): Promise<void> {
    // Validate new items [验证新项]
    await this.validateProductItemReferences(items, tx);
    this.validateProductItemQuantities(items);

    // Check for duplicate items [检查重复项]
    for (const item of items) {
      const existingItem = await tx
        .select({ id: schema.productItems.id })
        .from(schema.productItems)
        .where(
          and(
            eq(schema.productItems.productId, productId),
            eq(schema.productItems.serviceTypeId, item.serviceTypeId),
          ),
        )
        .limit(1);

      if (existingItem.length > 0) {
        throw new CatalogException("ITEM_ALREADY_IN_PRODUCT");
      }
    }

    // Get current max sortOrder [获取当前最大排序]
    const [maxSortOrder] = await tx
      .select({
        max: schema.productItems.sortOrder,
      })
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId))
      .orderBy(schema.productItems.sortOrder)
      .limit(1);

    const currentMax = maxSortOrder?.max ?? -1;

    // Insert new items with correct sortOrder [插入新项]
    await tx.insert(schema.productItems).values(
      items.map((item, index) => ({
        productId,
        serviceTypeId: item.serviceTypeId,
        quantity: item.quantity,
        sortOrder: item.sortOrder ?? currentMax + 1 + index,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  /**
   * 处理删除产品项
   * [Handle removing product items]
   */
  private async handleRemoveItems(
    tx: DrizzleTransaction,
    productId: string,
    itemIds: string[],
  ): Promise<void> {
    // Check if product has at least 1 item after removal [检查移除后至少保留1个项]
    const [currentCount] = await tx
      .select({ count: count() })
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId));

    if (Number(currentCount.count) <= itemIds.length) {
      throw new CatalogException("PRODUCT_MIN_ITEMS");
    }

    // Delete items [删除项]
    await tx
      .delete(schema.productItems)
      .where(
        and(
          eq(schema.productItems.productId, productId),
          inArray(schema.productItems.id, itemIds),
        ),
      );
  }

  /**
   * 处理排序产品项
   * [Handle sorting product items]
   */
  private async handleSortItems(
    tx: DrizzleTransaction,
    productId: string,
    sortItems: Array<{ itemId: string; sortOrder: number }>,
  ): Promise<void> {
    const itemIds = sortItems.map((item) => item.itemId);

    // Validate itemId array has no duplicates [验证无重复ID]
    const uniqueItemIds = [...new Set(itemIds)];
    if (uniqueItemIds.length !== itemIds.length) {
      throw new CatalogException("DUPLICATE_ITEM_ID", "Item IDs must be unique");
    }

    // Validate sortOrder values are non-negative integers [验证排序值为非负整数]
    for (const item of sortItems) {
      if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
        throw new CatalogException(
          "INVALID_SORT_ORDER",
          `Sort order must be a non-negative integer, got: ${item.sortOrder}`,
        );
      }
    }

    // Validate sortOrder values are unique [验证排序值唯一]
    const sortOrders = sortItems.map((item) => item.sortOrder);
    const uniqueSortOrders = [...new Set(sortOrders)];
    if (uniqueSortOrders.length !== sortOrders.length) {
      throw new CatalogException("DUPLICATE_SORT_ORDER", "Sort order values must be unique");
    }

    // Query all product items to get total count [查询所有产品项]
    const allProductItems = await tx
      .select({ id: schema.productItems.id })
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId));

    // Validate all items belong to this product [验证所有项属于该产品]
    const productItems = await tx
      .select({ id: schema.productItems.id })
      .from(schema.productItems)
      .where(
        and(
          eq(schema.productItems.productId, productId),
          inArray(schema.productItems.id, itemIds),
        ),
      );

    if (productItems.length !== itemIds.length) {
      throw new CatalogNotFoundException("PRODUCT_ITEM_NOT_FOUND");
    }

    // Validate must provide sort order for ALL product items [验证所有产品项都提供排序]
    if (allProductItems.length !== itemIds.length) {
      throw new CatalogException(
        "INCOMPLETE_SORT_ITEMS",
        `Must provide sort order for all items. Expected ${allProductItems.length}, got ${itemIds.length}`,
      );
    }

    // Batch update using Promise.all [批量更新]
    await Promise.all(
      sortItems.map((item) =>
        tx
          .update(schema.productItems)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(schema.productItems.productId, productId),
              eq(schema.productItems.id, item.itemId),
            ),
          ),
      ),
    );
  }

  /**
   * 验证封面图片格式
   * [Validate cover image format]
   */
  private validateCoverImageFormat(coverImage: string): void {
    const problematicChars = ["`", "\"", "'", ";", "\n", "\r"];
    const containsProblematicChars = problematicChars.some((char) =>
      coverImage.includes(char),
    );
    if (containsProblematicChars) {
      throw new CatalogException("INVALID_COVER_IMAGE_FORMAT", "Invalid characters in cover image");
    }
  }

  /**
   * 验证产品项引用
   * [Validate product item references]
   */
  private async validateProductItemReferences(
    items: Array<{ serviceTypeId: string }>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const db = tx || this.db;
    const serviceTypeIds = items.map((item) => item.serviceTypeId);
    const uniqueIds = [...new Set(serviceTypeIds)];

    // Validate UUID format [验证UUID格式]
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

  /**
   * 映射数据库记录到产品接口
   * [Map database record to product interface]
   */
  private mapToProductInterface(record: any): IProduct {
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      description: record.description ?? undefined,
      coverImage: record.coverImage ?? undefined,
      targetUserPersonas: this.safeArrayCast(record.targetUserPersona),
      price: String(record.price),
      currency: record.currency,
      marketingLabels: this.safeArrayCast(record.marketingLabels),
      status: record.status,
      publishedAt: record.publishedAt ?? undefined,
      unpublishedAt: record.unpublishedAt ?? undefined,
      metadata: record.metadata ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      items: [],
    };
  }

  /**
   * 映射数据库记录到产品项接口
   * [Map database record to product item interface]
   */
  private mapToProductItemInterface(record: any): IProductItem {
    return {
      id: record.id,
      productId: record.productId,
      serviceTypeId: record.serviceTypeId,
      quantity: record.quantity,
      sortOrder: record.sortOrder,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * 安全转换为数组
   * [Safely cast to array]
   */
  private safeArrayCast<T>(value: T | T[] | null | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}
