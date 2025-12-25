/**
 * Drizzle Product Query Repository Implementation
 * 基于 Drizzle 的产品查询仓储实现
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq, and, like, ne, count, sql, inArray, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { buildLikePattern } from '@domains/catalog/common/utils/sql.utils';
import { ProductStatus } from '@shared/types/catalog-enums';
import { CatalogNotFoundException, CatalogException } from '@domains/catalog/common/exceptions/catalog.exception';
import { IProductQueryRepository } from '../../interfaces/product-query.repository.interface';
import { ProductReadModel, ProductDetailReadModel, ProductItemReadModel } from '../../models/product-read.model';
import { SearchProductsDto, GetProductDetailDto } from '../../dto/product-query.dto';

@Injectable()
export class DrizzleProductQueryRepository implements IProductQueryRepository {
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly DEFAULT_SORT_FIELD = 'createdAt';
  private readonly DEFAULT_SORT_ORDER = 'desc';

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async searchProducts(dto: SearchProductsDto): Promise<IPaginatedResult<ProductReadModel>> {
    const { filter, pagination, sort } = dto;

    // Build where conditions
    const conditions = [];

    // Exclude deleted status by default
    if (!filter.includeDeleted) {
      conditions.push(ne(schema.products.status, ProductStatus.DELETED));
    }

    if (filter.status) {
      conditions.push(eq(schema.products.status, filter.status));
    }

    if (filter.userPersona) {
      conditions.push(
        sql`${schema.products.targetUserPersona}::jsonb @> ${JSON.stringify([filter.userPersona])}`,
      );
    }

    if (filter.marketingLabel) {
      conditions.push(
        sql`${schema.products.marketingLabels}::jsonb @> ${JSON.stringify([filter.marketingLabel])}`,
      );
    }

    if (filter.name) {
      const safeName = buildLikePattern(filter.name);
      conditions.push(like(schema.products.name, safeName));
    }

    if (filter.code) {
      const safeCode = buildLikePattern(filter.code);
      conditions.push(like(schema.products.code, safeCode));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query total count
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.products)
      .where(whereClause);

    // Query with pagination
    let products: typeof schema.products.$inferSelect[];
    if (!pagination) {
      products = await this.db
        .select()
        .from(schema.products)
        .where(whereClause)
        .orderBy(this.getOrderBy(sort));
    } else {
      const { page = 1, pageSize = this.DEFAULT_PAGE_SIZE } = pagination;
      const offset = (page - 1) * pageSize;

      products = await this.db
        .select()
        .from(schema.products)
        .where(whereClause)
        .orderBy(this.getOrderBy(sort))
        .limit(pageSize)
        .offset(offset);
    }

    // Optimize: Get all product items in a single query
    let productsWithItems: ProductReadModel[];
    if (products.length > 0) {
      const productIds = products.map(product => product.id);

      const allProductItems = await this.db
        .select()
        .from(schema.productItems)
        .where(inArray(schema.productItems.productId, productIds))
        .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

      // Group product items by productId
      const productItemsMap = new Map<string, typeof schema.productItems.$inferSelect[]>();
      allProductItems.forEach(item => {
        if (!productItemsMap.has(item.productId)) {
          productItemsMap.set(item.productId, []);
        }
        productItemsMap.get(item.productId)!.push(item);
      });

      // Build products with items
      productsWithItems = products.map(product => {
        const items = productItemsMap.get(product.id) || [];
        return {
          ...this.mapToProductReadModel(product),
          items: items.map(this.mapToProductItemReadModel.bind(this)),
        };
      });
    } else {
      productsWithItems = [];
    }

    return {
      data: productsWithItems,
      total: Number(total),
      page: pagination?.page || 1,
      pageSize: pagination?.pageSize || Number(total),
      totalPages: Math.ceil(Number(total) / (pagination?.pageSize || Number(total))),
    };
  }

  async getProductDetail(dto: GetProductDetailDto): Promise<ProductDetailReadModel | null> {
    const { id: productId } = dto;

    // 1. Find product
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    // 2. Get product items
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, product.id))
      .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

    if (items.length === 0) {
      return {
        ...this.mapToProductReadModel(product),
        items: [],
      };
    }

    // 3. Query service types info
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

    // 4. Build enriched product items
    const enrichedItems: ProductItemReadModel[] = items.map((i) => {
      const st = serviceTypeMap.get(i.serviceTypeId);
      if (!st) {
        throw new CatalogException(
          "SERVICE_TYPE_NOT_FOUND",
          `Service type not found for ID: ${i.serviceTypeId}`,
        );
      }
      return {
        ...this.mapToProductItemReadModel(i),
        serviceTypeCode: st.code,
        serviceTypeName: st.name,
      };
    });

    return {
      ...this.mapToProductReadModel(product),
      items: enrichedItems,
    };
  }

  private getOrderBy(sort?: SearchProductsDto['sort']) {
    const orderField = sort?.field || this.DEFAULT_SORT_FIELD;
    const orderDirection = sort?.order || this.DEFAULT_SORT_ORDER;

    const column =
      schema.products[orderField] || schema.products[this.DEFAULT_SORT_FIELD];
    return orderDirection === 'asc' ? column : desc(column);
  }

  private mapToProductReadModel(record: typeof schema.products.$inferSelect): ProductReadModel {
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      status: record.status,
      price: Number(record.price),
      currency: record.currency,
      userPersona: record.targetUserPersona?.[0] || null,
      marketingLabel: record.marketingLabels?.[0] || null,
      isRecommended: false,
      recommendPriority: 0,
      availableFrom: record.publishedAt,
      availableTo: record.unpublishedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };
  }

  private mapToProductItemReadModel(record: typeof schema.productItems.$inferSelect): ProductItemReadModel {
    return {
      id: record.id,
      productId: record.productId,
      serviceTypeId: record.serviceTypeId,
      serviceTypeCode: null, // Will be enriched if needed
      serviceTypeName: null, // Will be enriched if needed
      packageCode: null,
      quantity: record.quantity,
      note: null,
      sortOrder: record.sortOrder,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

