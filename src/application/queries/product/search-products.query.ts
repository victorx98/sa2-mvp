import { Inject, Injectable } from '@nestjs/common';
import { eq, and, like, ne, count, sql, inArray, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { ProductFilterDto } from '@api/dto/request/catalog/product.request.dto';
import { PaginationDto } from '@api/dto/request/catalog/product-list.request.dto';
import { SortDto } from '@api/dto/request/catalog/product-list.request.dto';
import { PaginatedResult } from '@shared/types/paginated-result';
import { buildLikePattern } from '@domains/catalog/common/utils/sql.utils';
import {
  Currency,
  MarketingLabel,
  ProductStatus,
  UserPersona,
} from '@shared/types/catalog-enums';
import { IProduct, IProductItem } from '@domains/catalog/product/interfaces';

export interface SearchProductsResult {
  data: IProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class SearchProductsQuery {
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly DEFAULT_SORT_FIELD = 'createdAt';
  private readonly DEFAULT_SORT_ORDER = 'desc';

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Search products with pagination [搜索产品，支持分页]
   *
   * @param filter - Filter criteria [筛选条件]
   * @param pagination - Pagination parameters [分页参数]
   * @param sort - Sorting parameters [排序参数]
   * @returns Paginated products result [分页产品结果]
   */
  async execute(
    filter: ProductFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IProduct>> {
    // Build where conditions [构建查询条件]
    const conditions = [];

    // Exclude deleted status by default [默认排除删除状态]
    if (!filter.includeDeleted) {
      conditions.push(ne(schema.products.status, ProductStatus.DELETED));
    }

    if (filter.status) {
      conditions.push(eq(schema.products.status, filter.status));
    }

    if (filter.userPersona) {
      // JSON array contains check [JSON数组包含检查]
      conditions.push(
        sql`${schema.products.targetUserPersona}::jsonb @> ${JSON.stringify([filter.userPersona])}`,
      );
    }

    if (filter.marketingLabel) {
      // JSON array contains check [JSON数组包含检查]
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

    // Query total count [查询总数]
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.products)
      .where(whereClause);

    // Return all data if no pagination parameters [如果没有分页参数，返回所有数据]
    let products: typeof schema.products.$inferSelect[];
    if (!pagination) {
      products = await this.db
        .select()
        .from(schema.products)
        .where(whereClause)
        .orderBy(this.getOrderBy(sort));
    } else {
      // Paginated query [分页查询]
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

    // Optimize: Get all product items in a single query instead of N+1 queries [优化：在单个查询中获取所有产品项，避免N+1查询]
    let productsWithItems: IProduct[];
    if (products.length > 0) {
      const productIds = products.map(product => product.id);

      // Single query to get all product items for the found products [单次查询获取所有找到产品的产品项]
      const allProductItems = await this.db
        .select()
        .from(schema.productItems)
        .where(inArray(schema.productItems.productId, productIds))
        .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt);

      // Group product items by productId for efficient lookup [按productId对产品项进行分组，以便高效查找]
      const productItemsMap = new Map<string, typeof schema.productItems.$inferSelect[]>();
      allProductItems.forEach(item => {
        if (!productItemsMap.has(item.productId)) {
          productItemsMap.set(item.productId, []);
        }
        productItemsMap.get(item.productId)!.push(item);
      });

      // Build products with items in memory [在内存中构建包含产品项的产品]
      productsWithItems = products.map(product => {
        const items = productItemsMap.get(product.id) || [];
        return {
          ...this.mapToProductInterface(product),
          items: items.map(this.mapToProductItemInterface.bind(this)),
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

  /**
   * Get order by clause [获取排序子句]
   */
  private getOrderBy(sort?: SortDto) {
    const orderField = sort?.field || this.DEFAULT_SORT_FIELD;
    const orderDirection = sort?.order || this.DEFAULT_SORT_ORDER;

    const column =
      schema.products[orderField] || schema.products[this.DEFAULT_SORT_FIELD];
    return orderDirection === 'asc' ? column : desc(column);
  }

  /**
   * Map database record to product interface [映射数据库记录到产品接口]
   */
  private mapToProductInterface(
    record: typeof schema.products.$inferSelect,
  ): IProduct {
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      description: record.description,
      coverImage: record.coverImage,
      targetUserPersonas: this.safeArrayCast(record.targetUserPersona) as UserPersona[],
      price: String(record.price),
      currency: record.currency as Currency,
      marketingLabels: this.safeArrayCast(record.marketingLabels) as MarketingLabel[],
      status: record.status as ProductStatus,
      publishedAt: record.publishedAt,
      unpublishedAt: record.unpublishedAt,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };
  }

  /**
   * Safely cast value to array, returning empty array if null/undefined [安全地将值转换为数组，如果为null/undefined则返回空数组]
   */
  private safeArrayCast<T>(value: T | T[] | null | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * Map database record to product item interface [映射数据库记录到产品项接口]
   */
  private mapToProductItemInterface(
    record: typeof schema.productItems.$inferSelect,
  ): IProductItem {
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
}
