import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { CatalogException, CatalogNotFoundException } from "@domains/catalog/common/exceptions/catalog.exception";
import { ProductStatus } from "@shared/types/catalog-enums";

export interface ProductEntitlementItem {
  id: string;
  productId: string;
  serviceTypeId: string;
  serviceTypeCode: string;
  serviceTypeName: string;
  quantity: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDetailWithEntitlements {
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImage?: string;
  targetUserPersonas?: unknown[];
  price: string;
  currency: string;
  marketingLabels?: unknown[];
  status: string;
  publishedAt?: Date;
  unpublishedAt?: Date;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  items: ProductEntitlementItem[];
}

@Injectable()
export class GetProductDetailQuery {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async execute(productId: string): Promise<ProductDetailWithEntitlements> {
    // 1. 查找产品
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    // 2. 获取产品项
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, product.id))
      .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

    if (items.length === 0) {
      return {
        ...(product as unknown as ProductDetailWithEntitlements),
        items: [],
      };
    }

    // 3. 查询服务类型信息
    const serviceTypeIds = Array.from(new Set(items.map((i) => i.serviceTypeId)));
    const serviceTypes = await this.db
      .select({
        id: schema.serviceTypes.id,
        code: schema.serviceTypes.code,
        name: schema.serviceTypes.name,
      })
      .from(schema.serviceTypes)
      .where(inArray(schema.serviceTypes.id, serviceTypeIds));

    const serviceTypeMap = new Map(
      serviceTypes.map((st) => [st.id, { code: st.code, name: st.name }]),
    );

    // 4. 构建富化后的产品项
    const enrichedItems: ProductEntitlementItem[] = items.map((i) => {
      const st = serviceTypeMap.get(i.serviceTypeId);
      if (!st) {
        throw new CatalogException(
          "SERVICE_TYPE_NOT_FOUND",
          `Service type not found for ID: ${i.serviceTypeId}`,
        );
      }
      return {
        ...i,
        serviceTypeCode: st.code,
        serviceTypeName: st.name,
      };
    });

    return {
      ...(product as unknown as ProductDetailWithEntitlements),
      items: enrichedItems,
    };
  }
}


