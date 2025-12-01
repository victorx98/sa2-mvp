import { Injectable, Inject } from "@nestjs/common";
import { eq, and, or, like, ne, count, sql, inArray } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { SortDto } from "../../common/dto/sort.dto";
import { PaginatedResult } from "@shared/types/paginated-result";
import { CreateProductDto } from "../dto/create-product.dto";
import { UpdateProductDto } from "../dto/update-product.dto";
import { AddProductItemDto } from "../dto/add-product-item.dto";

import { ProductFilterDto } from "../dto/product-filter.dto";
import { FindOneProductDto } from "../dto/find-one-product.dto";

import { IProduct } from "../interfaces/product.interface";
import { IProductSnapshot } from "../interfaces/product-snapshot.interface";
import { buildLikePattern } from "../../common/utils/sql.utils";
import {
  Currency,
  MarketingLabel,
  ProductStatus,
  UserPersona,
} from "@shared/types/catalog-enums";
import { IProductDetail, IProductItem } from "../interfaces";

@Injectable()
export class ProductService {
  private readonly DEFAULT_PAGE_SIZE = 20; // Default page size for pagination [分页的默认页面大小]
  private readonly DEFAULT_SORT_FIELD = "createdAt"; // Default sort field [默认排序字段]
  private readonly DEFAULT_SORT_ORDER = "desc"; // Default sort order [默认排序顺序]

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create product (draft status)
   */
  async create(dto: CreateProductDto, userId: string): Promise<IProduct> {
    // 1. Validate product code uniqueness
    const existingByCode = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.code, dto.code))
      .limit(1);

    if (existingByCode.length > 0) {
      throw new CatalogConflictException("PRODUCT_CODE_DUPLICATE");
    }

    // 2. Validate price and validity days
    if (dto.price <= 0) {
      throw new CatalogException("INVALID_PRICE");
    }

    // 3. Validate item references if provided
    if (dto.items && dto.items.length > 0) {
      await this.validateProductItemReferences(dto.items);
      await this.validateProductItemQuantities(dto.items);
    }

    // 4. Use transaction to ensure atomicity
    const product = await this.db.transaction(async (tx) => {
      // 4.1 Create product
      const [newProduct] = await tx
        .insert(schema.products)
        .values({
          name: dto.name,
          code: dto.code,
          description: dto.description,
          coverImage: dto.coverImage,
          targetUserPersona: dto.targetUserPersonas
            ? dto.targetUserPersonas
            : null,
          price: dto.price.toString(),
          currency: dto.currency || Currency.USD,
          // validityDays field doesn't exist in schema, removing it
          marketingLabels: dto.marketingLabels ? dto.marketingLabels : null,
          status: ProductStatus.DRAFT,
          metadata: dto.metadata ? dto.metadata : null,
          createdBy: userId,
        })
        .returning();

      // 4.2 Create item records if provided
      if (dto.items && dto.items.length > 0) {
        await tx.insert(schema.productItems).values(
          dto.items.map((item, index) => ({
            productId: newProduct.id,
            serviceTypeId: item.serviceTypeId, // Use serviceTypeId as referenceId
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        );
      }

      return newProduct;
    });

    return this.mapToProductInterface(product);
  }

  /**
   * Update unpublished draft product [更新未发布的草稿产品]
   * Only draft products can be updated [仅草稿状态的产品可以更新]
   */
  async update(productId: string, dto: UpdateProductDto): Promise<IProduct> {
    // 1. Check if product exists [检查产品是否存在]
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status === ProductStatus.DELETED) {
      throw new CatalogGoneException("PRODUCT_DELETED");
    }

    // 2. Can only update draft products [只能更新草稿状态的产品]
    if (product.status !== ProductStatus.DRAFT) {
      throw new CatalogException("PRODUCT_NOT_DRAFT");
    }

    // 3. Validate price [验证价格]
    if (dto.price !== undefined && dto.price <= 0) {
      throw new CatalogException("INVALID_PRICE");
    }

    // 4. Update product [更新产品]
    const [updated] = await this.db
      .update(schema.products)
      .set({
        ...dto,
        price: dto.price !== undefined ? dto.price.toString() : undefined,
        targetUserPersona: dto.targetUserPersonas
          ? dto.targetUserPersonas
          : undefined,
        marketingLabels: dto.marketingLabels ? dto.marketingLabels : undefined,
        metadata: dto.metadata ? dto.metadata : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, productId))
      .returning();

    return this.mapToProductInterface(updated);
  }

  /**
   * Add service or service package to product
   */
  async addItem(productId: string, dto: AddProductItemDto): Promise<void> {
    // 1. Check if product exists and is draft
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (existing[0].status !== ProductStatus.DRAFT) {
      throw new CatalogException("PRODUCT_NOT_DRAFT");
    }

    // 2. Validate reference exists and is active
    await this.validateProductItemReferences([
      { serviceTypeId: dto.serviceTypeId },
    ]);
    await this.validateProductItemQuantities([
      { serviceTypeId: dto.serviceTypeId, quantity: dto.quantity },
    ]);

    // 3. Check if item already exists in product
    const existingItem = await this.db
      .select()
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

    // 4. Add product item
    await this.db.insert(schema.productItems).values({
      productId,
      serviceTypeId: dto.serviceTypeId,
      quantity: dto.quantity,
      sortOrder: dto.sortOrder ?? 0, // Use provided sortOrder or default to 0 [使用提供的sortOrder或默认为0]
    });
  }

  /**
   * Remove service or service package from product
   */
  async removeItem(productId: string, itemId: string): Promise<void> {
    // 1. Check if product exists and is draft
    const product = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (product.length === 0) {
      throw new CatalogException("PRODUCT_NOT_FOUND");
    }

    if (product[0].status !== ProductStatus.DRAFT) {
      throw new CatalogException("PRODUCT_NOT_DRAFT");
    }

    // 2. Product must contain at least 1 item
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId));

    if (items.length <= 1) {
      throw new CatalogException("PRODUCT_MIN_ITEMS");
    }

    // 3. Delete product item
    await this.db
      .delete(schema.productItems)
      .where(
        and(
          eq(schema.productItems.id, itemId),
          eq(schema.productItems.productId, productId),
        ),
      );
  }

  /**
   * Update product item sort order [更新产品项排序]
   */
  async updateItemSortOrder(
    productId: string,
    items: Array<{ itemId: string; sortOrder: number }>,
  ): Promise<void> {
    // 1. Check if product exists
    const product = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (product.length === 0) {
      throw new CatalogException("PRODUCT_NOT_FOUND");
    }

    // 2. Update sortOrder for each item in a transaction
    await this.db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(schema.productItems)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(schema.productItems.id, item.itemId),
              eq(schema.productItems.productId, productId),
            ),
          );
      }
    });
  }

  /**
   * Search products with pagination
   */
  async search(
    filter: ProductFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IProduct>> {
    // Build where conditions
    const conditions = [];

    // Exclude deleted status by default
    if (!filter.includeDeleted) {
      conditions.push(ne(schema.products.status, ProductStatus.DELETED));
    }

    if (filter.status) {
      conditions.push(eq(schema.products.status, filter.status));
    }

    if (filter.userType) {
      // JSON array contains check
      conditions.push(
        sql`${schema.products.targetUserPersona}::jsonb @> ${JSON.stringify([filter.userType])}`,
      );
    }

    if (filter.marketingLabel) {
      // JSON array contains check
      conditions.push(
        sql`${schema.products.marketingLabels}::jsonb @> ${JSON.stringify([filter.marketingLabel])}`,
      );
    }

    if (filter.keyword) {
      const safeKeyword = buildLikePattern(filter.keyword);
      conditions.push(
        or(
          like(schema.products.name, safeKeyword),
          like(schema.products.code, safeKeyword),
          like(schema.products.description, safeKeyword),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query total count
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.products)
      .where(whereClause);

    // Return all data if no pagination parameters
    if (!pagination) {
      const allData = await this.db
        .select()
        .from(schema.products)
        .where(whereClause)
        .orderBy(this.getOrderBy(sort));

      return {
        data: allData.map(this.mapToProductInterface.bind(this)),
        total: Number(total),
        page: 1,
        pageSize: Number(total),
        totalPages: 1,
      };
    }

    // Paginated query
    const { page = 1, pageSize = this.DEFAULT_PAGE_SIZE } = pagination;
    const offset = (page - 1) * pageSize;

    const data = await this.db
      .select()
      .from(schema.products)
      .where(whereClause)
      .orderBy(this.getOrderBy(sort))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map(this.mapToProductInterface.bind(this)),
      total: Number(total),
      page,
      pageSize,
      totalPages: Math.ceil(Number(total) / pageSize),
    };
  }

  /**
   * Find one product by conditions
   */
  async findOne(where: FindOneProductDto): Promise<IProductDetail | null> {
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

    // Exclude deleted status by default [默认排除删除状态]
    if (!where.includeDeleted) {
      conditions.push(ne(schema.products.status, ProductStatus.DELETED));
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

    // Get product items
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, product.id))
      .orderBy(schema.productItems.createdAt); // Use createdAt for ordering since sortOrder doesn't exist [使用 createdAt 进行排序，因为 sortOrder 不存在]

    // Since services and service_packages tables are not needed in the project,
    // we only return product items with basic information
    // [由于项目中不需要services和service_packages表，我们只返回带有基本信息的产品项]
    return {
      ...this.mapToProductInterface(product),
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        serviceTypeId: item.serviceTypeId,
        quantity: item.quantity,
        sortOrder: item.sortOrder, // Add sortOrder property [添加排序属性]
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  /**
   * Publish product [发布产品]
   */
  async publish(id: string): Promise<IProduct> {
    const product = await this.findOne({ id });

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product.status !== ProductStatus.DRAFT) {
      throw new CatalogException("INVALID_STATUS_TRANSITION");
    }

    // Validate product item references [验证产品项引用]
    await this.validateProductItemReferences(product.items || []);

    // Update product status [更新产品状态]
    const updatedProduct = await this.db
      .update(schema.products)
      .set({
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(updatedProduct[0]);
  }

  /**
   * Unpublish product [取消发布产品]
   */
  async unpublish(id: string): Promise<IProduct> {
    const product = await this.findOne({ id });

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new CatalogException("INVALID_STATUS_TRANSITION");
    }

    // Update product status [更新产品状态]
    const updatedProduct = await this.db
      .update(schema.products)
      .set({
        status: ProductStatus.INACTIVE,
        unpublishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(updatedProduct[0]);
  }

  /**
   * Revert product to draft [将产品恢复为草稿]
   */
  async revertToDraft(id: string): Promise<IProduct> {
    const product = await this.findOne({ id });

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product.status !== ProductStatus.INACTIVE) {
      throw new CatalogException("INVALID_STATUS_TRANSITION");
    }

    // Update product status [更新产品状态]
    const updatedProduct = await this.db
      .update(schema.products)
      .set({
        status: ProductStatus.DRAFT,
        unpublishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(updatedProduct[0]);
  }

  /**
   * Create product snapshot [创建产品快照]
   */
  async createSnapshot(id: string): Promise<IProductSnapshot> {
    const product = await this.findOne({ id });

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new CatalogException("PRODUCT_NOT_PUBLISHED");
    }

    // Create snapshot items [创建快照项]
    const items = await Promise.all(
      product.items.map(async (item) => {
        return {
          serviceTypeId: item.serviceTypeId,
          quantity: item.quantity,
        };
      }),
    );

    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      price: product.price,
      currency: product.currency,
      items,
      snapshotAt: new Date(),
    };
  }

  // ==================== Private helper methods ====================

  /**
   * Validate product item references [验证产品项引用]
   * - Validates UUID format
   * - Checks service types exist and are ACTIVE (batch query for performance)
   */
  private async validateProductItemReferences(
    items: Array<{ serviceTypeId: string } | IProductItem>,
  ): Promise<void> {
    // Validate UUID format first [首先验证UUID格式]
    const serviceTypeIds = items.map((item) => item.serviceTypeId);

    for (const serviceTypeId of serviceTypeIds) {
      if (!serviceTypeId || serviceTypeId.trim() === "") {
        throw new CatalogNotFoundException("REFERENCE_NOT_FOUND");
      }

      // Basic UUID validation [基本UUID验证]
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(serviceTypeId)) {
        throw new CatalogNotFoundException("INVALID_REFERENCE_ID");
      }
    }

    // Batch query service types [批量查询服务类型]
    const serviceTypes = await this.db
      .select({
        id: schema.serviceTypes.id,
        status: schema.serviceTypes.status,
      })
      .from(schema.serviceTypes)
      .where(inArray(schema.serviceTypes.id, serviceTypeIds));

    // Check all service types exist and are ACTIVE [检查所有服务类型存在且为ACTIVE状态]
    if (serviceTypes.length !== serviceTypeIds.length) {
      throw new CatalogException("SERVICE_TYPE_NOT_FOUND");
    }

    for (const serviceType of serviceTypes) {
      if (serviceType.status !== "ACTIVE") {
        throw new CatalogException("SERVICE_TYPE_NOT_ACTIVE");
      }
    }
  }

  /**
   * Validate product item quantities [验证产品项数量]
   */
  private async validateProductItemQuantities(
    items: Array<{ serviceTypeId: string; quantity: number } | IProductItem>,
  ): Promise<void> {
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new CatalogException("INVALID_QUANTITY");
      }
    }
  }

  /**
   * Get order by clause [获取排序子句]
   */
  private getOrderBy(sort?: SortDto) {
    const field = sort?.field || this.DEFAULT_SORT_FIELD; // Use default sort field if not provided [如果未提供则使用默认排序字段]
    const order = sort?.order || this.DEFAULT_SORT_ORDER; // Use default sort order if not provided [如果未提供则使用默认排序顺序]

    const column =
      schema.products[field] || schema.products[this.DEFAULT_SORT_FIELD];
    return order === "asc" ? column : sql`${column} DESC`;
  }

  /**
   * Map database record to interface [映射数据库记录到接口]
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
      targetUserPersonas: record.targetUserPersona as UserPersona[],
      price: record.price.toString(), // Convert numeric to string [将数字转换为字符串]
      currency: record.currency as Currency,
      marketingLabels: record.marketingLabels as MarketingLabel[],
      status: record.status as ProductStatus,
      publishedAt: record.publishedAt,
      unpublishedAt: record.unpublishedAt,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };
  }
}
