import { Inject, Injectable } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { ProductService } from "@domains/catalog/product/services/product.service";
import { CatalogException, CatalogNotFoundException } from "@domains/catalog/common/exceptions/catalog.exception";

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
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly productService: ProductService,
  ) {}

  async execute(productId: string): Promise<ProductDetailWithEntitlements> {
    const product = await this.productService.findOne({ id: productId });
    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const items = product.items ?? [];
    if (items.length === 0) {
      return {
        ...(product as unknown as ProductDetailWithEntitlements),
        items: [],
      };
    }

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


