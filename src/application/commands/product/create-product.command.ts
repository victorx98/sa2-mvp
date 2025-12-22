import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { CreateProductRequestDto } from "@api/dto/request/catalog/product.request.dto";
import { IProduct, IProductItem } from "@domains/catalog/product/interfaces";
import { ProductStatus } from "@shared/types/catalog-enums";
import { Currency } from "@shared/types/catalog-enums";
import { CatalogException, CatalogConflictException } from "@domains/catalog/common/exceptions/catalog.exception";
import * as schema from "@infrastructure/database/schema";
/**
 * Create Product Command (Application Layer)
 * [创建产品命令]
 *
 * 职责：
 * 1. 编排产品创建用例
 * 2. 执行业务规则验证
 * 3. 管理事务
 * 4. 执行数据库操作
 */
@Injectable()
export class CreateProductCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
  ) {
    super(db);
  }

  /**
   * 执行创建产品用例
   * [Execute create product use case]
   *
   * @param input 创建产品输入参数
   * @param userId 创建者ID
   * @returns 创建的产品
   */
  async execute(input: CreateProductRequestDto, userId: string): Promise<IProduct> {
    this.logger.debug(`Creating product: ${input.name}`);

    // 1. Validate product code uniqueness [验证产品编码唯一性]
    await this.validateProductCodeUniqueness(input.code);

    // 2. Validate price [验证价格]
    if (input.price <= 0) {
      throw new CatalogException("INVALID_PRICE");
    }

    // 3. Validate coverImage format [验证封面图片格式]
    if (input.coverImage) {
      this.validateCoverImageFormat(input.coverImage);
    }

    // 4. Validate item references if provided [验证产品项引用]
    if (input.items && input.items.length > 0) {
      await this.validateProductItemReferences(input.items);
      this.validateProductItemQuantities(input.items);
    }

    // 5. Use transaction to ensure atomicity [使用事务确保原子性]
    const product = await this.db.transaction(async (tx) => {
      // 5.1 Create product [创建产品]
      const [newProduct] = await tx
        .insert(schema.products)
        .values({
          name: input.name,
          code: input.code,
          description: input.description ?? null,
          coverImage: input.coverImage ?? null,
          targetUserPersona: input.targetUserPersonas ? input.targetUserPersonas : null,
          price: input.price.toString(),
          currency: input.currency || Currency.USD,
          marketingLabels: input.marketingLabels ? input.marketingLabels : null,
          status: ProductStatus.DRAFT,
          metadata: input.metadata ? input.metadata : null,
          createdBy: userId,
        })
        .returning();

      // 5.2 Create item records if provided [创建产品项记录]
      if (input.items && input.items.length > 0) {
        await tx.insert(schema.productItems).values(
          input.items.map((item, index) => ({
            productId: newProduct.id,
            serviceTypeId: item.serviceTypeId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        );
      }

      return newProduct;
    });

    this.logger.debug(`Product created successfully: ${product.id}`);
    return this.mapToProductInterface(product);
  }

  /**
   * Validate product code uniqueness [验证产品编码唯一性]
   */
  private async validateProductCodeUniqueness(code: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.code, code))
      .limit(1);

    if (existing) {
      throw new CatalogConflictException("PRODUCT_CODE_DUPLICATE");
    }
  }

  /**
   * Validate coverImage format [验证封面图片格式]
   */
  private validateCoverImageFormat(coverImage: string): void {
    // Check for problematic characters [检查问题字符]
    const problematicChars = ["`", "\"", "'", ";", "\n", "\r"];
    const containsProblematicChars = problematicChars.some((char) =>
      coverImage.includes(char),
    );
    if (containsProblematicChars) {
      throw new CatalogException(
        "INVALID_COVER_IMAGE_FORMAT",
        "Cover image URL contains invalid characters",
      );
    }
  }

  /**
   * Validate product item references [验证产品项引用]
   */
  private async validateProductItemReferences(
    items: Array<{ serviceTypeId: string }>,
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const serviceTypeIds = items.map((item) => item.serviceTypeId);
    const uniqueIds = [...new Set(serviceTypeIds)];

    // Validate UUID format [验证UUID格式]
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const id of uniqueIds) {
      if (!uuidRegex.test(id)) {
        throw new CatalogException(
          "INVALID_SERVICE_TYPE_ID",
          `Invalid service type ID format: ${id}`,
        );
      }
    }
  }

  /**
   * Validate product item quantities [验证产品项数量]
   */
  private validateProductItemQuantities(
    items: Array<{ quantity: number }>,
  ): void {
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new CatalogException("INVALID_QUANTITY");
      }
    }
  }

  /**
   * Map database record to product interface [映射数据库记录到产品接口]
   */
  private mapToProductInterface(
    record: any, // The actual type would be inferred from Drizzle
  ): IProduct {
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
      items: [], // Items will be fetched separately if needed
    };
  }

  /**
   * Safely cast value to array [安全转换为数组]
   */
  private safeArrayCast<T>(value: T | T[] | null | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}

