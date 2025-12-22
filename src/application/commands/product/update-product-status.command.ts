import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, count, and, sql } from "drizzle-orm";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { IProduct, IProductItem } from "@domains/catalog/product/interfaces";
import { ProductStatus } from "@shared/types/catalog-enums";
import * as schema from "@infrastructure/database/schema";
import {
  CatalogException,
  CatalogNotFoundException,
} from "@domains/catalog/common/exceptions/catalog.exception";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

/**
 * Update Product Status Command (Application Layer)
 * [更新产品状态命令]
 *
 * 职责：
 * 1. 编排产品状态更新用例
 * 2. 执行业务规则验证（状态机）
 * 3. 管理事务
 * 4. 处理发布/下架逻辑
 */
@Injectable()
export class UpdateProductStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
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
    this.logger.debug(`Updating product status: ${productId} -> ${targetStatus}`);

    // Wrap in transaction with row lock to ensure atomicity [使用事务和行锁确保原子性]
    const updatedProduct = await this.db.transaction(async (tx) => {
      // Retrieve product with row lock [检索产品并加行锁]
      const [product] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);

      if (!product) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      // Handle state transitions [处理状态转换]
      switch (targetStatus) {
        case ProductStatus.ACTIVE:
          return await this.publishProduct(tx, productId, product);
        case ProductStatus.INACTIVE:
          return await this.unpublishProduct(tx, productId, product);
        case ProductStatus.DRAFT:
          return await this.revertToDraft(tx, productId, product);
        default:
          throw new CatalogException(
            "INVALID_STATUS_TRANSITION",
            `Invalid target status: ${targetStatus}`,
          );
      }
    });

    // Get product items to include in response [获取产品项]
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId))
      .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

    this.logger.debug(`Product status updated: ${productId} -> ${updatedProduct.status}`);

    return {
      ...this.mapToProductInterface(updatedProduct),
      items: this.safeArrayCast(items).map(this.mapToProductItemInterface.bind(this)),
    };
  }

  /**
   * 发布产品 (DRAFT -> ACTIVE)
   * [Publish product]
   */
  private async publishProduct(
    tx: any,
    id: string,
    product: any,
  ): Promise<any> {
    // Publish logic (DRAFT -> ACTIVE) [发布逻辑]
    if (product.status !== ProductStatus.DRAFT) {
      throw new CatalogException(
        "INVALID_STATUS_TRANSITION",
        `Cannot publish product. Product must be in DRAFT status, but current status is ${product.status}`,
      );
    }

    // Verify product has at least one item [验证产品至少有一个项目]
    const items = await tx
      .select({ id: schema.productItems.id })
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, id))
      .limit(1);

    if (items.length === 0) {
      throw new CatalogException(
        "PRODUCT_MIN_ITEMS",
        "Product must have at least one item to be published",
      );
    }

    // Update product status [更新产品状态]
    const [published] = await tx
      .update(schema.products)
      .set({
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    if (!published) {
      throw new CatalogException("UPDATE_PRODUCT_STATUS_FAILED");
    }

    return published;
  }

  /**
   * 下架产品 (ACTIVE/DRAFT -> INACTIVE)
   * [Unpublish product]
   */
  private async unpublishProduct(
    tx: any,
    id: string,
    product: any,
  ): Promise<any> {
    // Unpublish logic [下架逻辑]
    if (product.status !== ProductStatus.ACTIVE && product.status !== ProductStatus.DRAFT) {
      throw new CatalogException(
        "INVALID_STATUS_TRANSITION",
        `Cannot unpublish product. Product must be in ACTIVE or DRAFT status, but current status is ${product.status}`,
      );
    }

    // Update product status [更新产品状态]
    const [unpublished] = await tx
      .update(schema.products)
      .set({
        status: ProductStatus.INACTIVE,
        unpublishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return unpublished;
  }

  /**
   * 重置为草稿 (ACTIVE -> DRAFT)
   * [Revert to draft]
   */
  private async revertToDraft(
    tx: any,
    id: string,
    product: any,
  ): Promise<any> {
    // Draft logic [草稿逻辑]
    if (product.status !== ProductStatus.ACTIVE) {
      throw new CatalogException(
        "INVALID_STATUS_TRANSITION",
        `Cannot revert to DRAFT. Product must be in ACTIVE status, but current status is ${product.status}`,
      );
    }

    // Update product status [更新产品状态]
    const [reverted] = await tx
      .update(schema.products)
      .set({
        status: ProductStatus.DRAFT,
        unpublishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return reverted;
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
