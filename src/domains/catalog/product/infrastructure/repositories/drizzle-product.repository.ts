/**
 * Drizzle Product Repository (Drizzle产品仓储)
 * Implementation of IProductRepository using Drizzle ORM (使用Drizzle ORM实现IProductRepository)
 */

import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ilike, inArray, sql } from 'drizzle-orm';
import { Product, ProductItem } from '../../entities';
import {
  IProductRepository,
  ProductSearchCriteria,
  ProductSearchResult,
} from '../../repositories';
import { ProductMapper } from '../mappers/product.mapper';
import { ProductCode } from '../../value-objects';
import * as schema from '@infrastructure/database/schema';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

@Injectable()
export class DrizzleProductRepository implements IProductRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) 
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly mapper: ProductMapper,
  ) {}

  /**
   * Find product by ID (通过ID查找产品)
   */
  async findById(id: string): Promise<Product | null> {
    const [record] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));

    if (!record) {
      return null;
    }

    // Fetch product items (获取产品项)
    const itemRecords = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, id))
      .orderBy(schema.productItems.sortOrder);

    return this.mapper.toDomain(record, itemRecords);
  }

  /**
   * Find product by unique code (通过唯一编码查找产品)
   */
  async findByCode(code: ProductCode): Promise<Product | null> {
    const [record] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.code, code.getValue()));

    if (!record) {
      return null;
    }

    const itemRecords = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, record.id))
      .orderBy(schema.productItems.sortOrder);

    return this.mapper.toDomain(record, itemRecords);
  }

  /**
   * Check if product with given code exists (检查是否存在指定编码的产品)
   */
  async existsByCode(code: ProductCode): Promise<boolean> {
    const [record] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.code, code.getValue()))
      .limit(1);

    return !!record;
  }

  /**
   * Search products by criteria (根据条件搜索产品)
   */
  async search(criteria: ProductSearchCriteria): Promise<ProductSearchResult> {
    const {
      status,
      nameContains,
      codeContains,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = criteria;

    // Build where conditions (构建where条件)
    const conditions = [];

    if (status) {
      conditions.push(eq(schema.products.status, status));
    }

    if (nameContains) {
      conditions.push(ilike(schema.products.name, `%${nameContains}%`));
    }

    if (codeContains) {
      conditions.push(ilike(schema.products.code, `%${codeContains}%`));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count (获取总数)
    const countResult = await this.db
      .select({ count: sql`count(*)`.as('count') })
      .from(schema.products)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    // Get products (获取产品)
    const records = await this.db
      .select()
      .from(schema.products)
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Get product IDs for fetching items (获取产品ID以获取items)
    const productIds = records.map((r) => r.id);

    // Fetch all items for these products in a single query (通过一次查询获取这些产品的所有items)
    const allItemRecords =
      productIds.length > 0
        ? await this.db
            .select()
            .from(schema.productItems)
            .where(inArray(schema.productItems.productId, productIds))
            .orderBy(
              schema.productItems.productId,
              schema.productItems.sortOrder,
            )
        : [];

    // Group items by product ID (按产品ID分组items)
    const itemsByProductId = allItemRecords.reduce((acc, item) => {
      if (!acc[item.productId]) {
        acc[item.productId] = [];
      }
      acc[item.productId].push(item);
      return acc;
    }, {});

    // Map products (映射产品)
    const products = records.map((record) => {
      const itemRecords = itemsByProductId[record.id] || [];
      return this.mapper.toDomain(record, itemRecords);
    });

    return {
      products,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Save a new product (保存新产品)
   */
  async save(product: Product): Promise<Product> {
    return this.db.transaction(async (tx) => {
      const data = this.mapper.toPersistence(product);

      // Insert product (插入产品)
      await tx.insert(schema.products).values(data.product);

      // Insert items (插入items)
      if (data.items.length > 0) {
        await tx.insert(schema.productItems).values(data.items);
      }

      return product;
    });
  }

  /**
   * Update an existing product (更新现有产品)
   */
  async update(product: Product): Promise<Product> {
    return this.db.transaction(async (tx) => {
      const data = this.mapper.toPersistence(product);

      // Update product (更新产品)
      await tx
        .update(schema.products)
        .set({
          name: data.product.name,
          description: data.product.description,
          price: data.product.price,
          currency: data.product.currency,
          status: data.product.status,
          publishedAt: data.product.publishedAt,
          unpublishedAt: data.product.unpublishedAt,
          updatedAt: new Date(),
          updatedBy: data.product.updatedBy,
        })
        .where(eq(schema.products.id, data.product.id));

      // Delete existing items (删除现有items)
      await tx
        .delete(schema.productItems)
        .where(eq(schema.productItems.productId, data.product.id));

      // Insert new items (插入新items)
      if (data.items.length > 0) {
        await tx.insert(schema.productItems).values(data.items);
      }

      return product;
    });
  }

  /**
   * Delete a product (soft delete) (删除产品（软删除）)
   */
  async delete(id: string, deletedBy: string): Promise<void> {
    await this.db
      .update(schema.products)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(eq(schema.products.id, id));
  }

  /**
   * Execute operations within a transaction (在事务中执行操作)
   */
  async withTransaction<T>(
    fn: (repo: IProductRepository) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txRepo = new DrizzleProductRepository(tx as any, this.mapper);
      return fn(txRepo);
    });
  }
}
