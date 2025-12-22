import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, inArray, and } from "drizzle-orm";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { IProductSnapshot } from "@domains/catalog/product/interfaces";
import { IProduct, IProductItem } from "@domains/catalog/product/interfaces";
import { ProductStatus, Currency, UserPersona, MarketingLabel } from "@shared/types/catalog-enums";
import * as schema from "@infrastructure/database/schema";
import {
  CatalogException,
  CatalogNotFoundException,
} from "@domains/catalog/common/exceptions/catalog.exception";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

/**
 * Create Product Snapshot Command (Application Layer)
 * [创建产品快照命令]
 *
 * 职责：
 * 1. 编排创建产品快照用例
 * 2. 执行业务规则验证（产品必须在ACTIVE状态）
 * 3. 查询产品信息和服务类型
 * 4. 创建带serviceTypeCode的快照
 */
@Injectable()
export class CreateProductSnapshotCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行创建产品快照用例
   * [Execute create product snapshot use case]
   *
   * @param productId 产品ID
   * @returns 创建的产品快照
   */
  async execute(productId: string): Promise<IProductSnapshot> {
    this.logger.debug(`Creating snapshot for product: ${productId}`);

    // 1. 查询产品
    const product = await this.findOne({ id: productId });

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new CatalogException(
        "PRODUCT_NOT_PUBLISHED",
        `Product must be in ACTIVE status, but current status is ${product.status}`,
      );
    }

    // 2. 收集服务类型ID并查询编码
    const serviceTypeIds = product.items.map((item) => item.serviceTypeId);
    const serviceTypes = await this.db
      .select({
        id: schema.serviceTypes.id,
        code: schema.serviceTypes.code,
      })
      .from(schema.serviceTypes)
      .where(inArray(schema.serviceTypes.id, serviceTypeIds));

    const serviceTypeCodeMap = new Map(serviceTypes.map((st) => [st.id, st.code]));

    // 3. 构建带serviceTypeCode的快照项
    const items = product.items.map((item) => {
      const serviceTypeCode = serviceTypeCodeMap.get(item.serviceTypeId);
      if (!serviceTypeCode) {
        throw new CatalogException(
          "SERVICE_TYPE_NOT_FOUND",
          `Service type not found for ID: ${item.serviceTypeId}`,
        );
      }
      return {
        serviceTypeId: item.serviceTypeId,
        serviceTypeCode,
        quantity: item.quantity,
      };
    });

    this.logger.debug(`Product snapshot created successfully: ${productId}`);

    return {
      productId: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      items,
      createdAt: new Date(),
    };
  }

  /**
   * 查询单个产品
   * [Find one product]
   */
  private async findOne(where: { id?: string; code?: string }): Promise<IProduct | null> {
    if (!where.id && !where.code) {
      throw new CatalogException("INVALID_QUERY");
    }

    const conditions = [];
    if (where.id) {
      conditions.push(eq(schema.products.id, where.id));
    }
    if (where.code) {
      conditions.push(eq(schema.products.code, where.code));
    }

    const result = await this.db
      .select()
      .from(schema.products)
      .where(and(...conditions))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const product = result[0];

    // 查询产品项
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, product.id))
      .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

    return {
      id: product.id,
      name: product.name,
      code: product.code,
      description: product.description ?? undefined,
      coverImage: product.coverImage ?? undefined,
      targetUserPersonas: this.safeArrayCast(product.targetUserPersona) as UserPersona[],
      price: String(product.price),
      currency: product.currency as Currency,
      marketingLabels: this.safeArrayCast(product.marketingLabels) as MarketingLabel[],
      status: product.status as ProductStatus,
      publishedAt: product.publishedAt ?? undefined,
      unpublishedAt: product.unpublishedAt ?? undefined,
      metadata: product.metadata ?? undefined,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      createdBy: product.createdBy,
      items: this.safeArrayCast(items).map(this.mapToProductItemInterface.bind(this)),
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
