import { Injectable, Inject, Logger } from "@nestjs/common";
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
  private readonly logger = new Logger(ProductService.name);
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

    // 3. Validate coverImage format - ensure it doesn't contain unexpected data like price or currency
    if (dto.coverImage) {
      // Check if coverImage contains problematic characters that could cause parameter parsing issues
      const problematicChars = [',', '`', '"', '\'', ';', '\n', '\r'];
      const containsProblematicChars = problematicChars.some(char => dto.coverImage!.includes(char));
      
      if (containsProblematicChars) {
        throw new CatalogException("INVALID_COVER_IMAGE_FORMAT", "Cover image URL should not contain commas, backticks, quotes, semicolons, or newlines");
      }
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

    // 4. Validate coverImage format if provided - ensure it doesn't contain unexpected data like price or currency
    if (dto.coverImage) {
      // Check if coverImage contains problematic characters that could cause parameter parsing issues
      const problematicChars = [',', '`', '"', '\'', ';', '\n', '\r'];
      const containsProblematicChars = problematicChars.some(char => dto.coverImage!.includes(char));
      
      if (containsProblematicChars) {
        throw new CatalogException("INVALID_COVER_IMAGE_FORMAT", "Cover image URL should not contain commas, backticks, quotes, semicolons, or newlines");
      }
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
   * Add service or service package to product (添加服务或服务项目到产品) [向产品添加服务或服务包]
   */
  async addItem(productId: string, dto: AddProductItemDto): Promise<void> {
    // Wrap operations in transaction to ensure atomicity [将操作包裹在事务中以确保原子性]
    try {
      await this.db.transaction(async (tx) => {
        // 1. Check if product exists and is draft with row lock [检查产品是否存在且为草稿状态，并加行锁]
        const [existing] = await tx
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, productId))
          .for("update") // Row-level lock to prevent concurrent modifications [行级锁防止并发修改]
          .limit(1);

      if (!existing) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (existing.status !== ProductStatus.DRAFT) {
        throw new CatalogException("PRODUCT_NOT_DRAFT");
      }

      // 2. Validate reference exists and is active [验证引用存在且处于激活状态]
      await this.validateProductItemReferences([
        { serviceTypeId: dto.serviceTypeId },
      ], tx); // Pass transaction context [传递事务上下文]
      await this.validateProductItemQuantities([
        { serviceTypeId: dto.serviceTypeId, quantity: dto.quantity },
      ]);

      // 3. Check if item already exists in product [检查产品项是否已存在于产品中]
      const existingItem = await tx
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

      // 4. Add product item [添加产品项]
      await tx.insert(schema.productItems).values({
        productId,
        serviceTypeId: dto.serviceTypeId,
        quantity: dto.quantity,
        sortOrder: dto.sortOrder ?? 0, // Use provided sortOrder or default to 0 [使用提供的sortOrder或默认为0]
      });
    });
    } catch (error) {
      // Enhanced error logging with full error details [增强错误日志，包含完整错误详情]
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorCause = (error as { cause?: unknown })?.cause;
      
      // Extract PostgreSQL error details if available [提取PostgreSQL错误详情（如果可用）]
      const pgError = errorCause && typeof errorCause === "object" && "code" in errorCause
        ? {
            code: (errorCause as { code?: string }).code,
            message: (errorCause as { message?: string }).message,
            detail: (errorCause as { detail?: string }).detail,
          }
        : null;
      
      // Log full error details for debugging [记录完整错误详情以便调试]
      this.logger.error(
        `Failed to add product item. ProductId: ${productId}, ServiceTypeId: ${dto.serviceTypeId}`,
        {
          error: errorMessage,
          stack: errorStack,
          pgError,
          cause: errorCause,
        },
      );
      
      // Re-throw original error to preserve error type [重新抛出原始错误以保留错误类型]
      throw error;
    }
  }

  /**
   * Remove service or service package from product (从产品中删除服务或服务项目) [从产品移除服务或服务包]
   */
  async removeItem(itemId: string): Promise<void> {
    // Wrap operations in transaction to ensure atomicity [将操作包裹在事务中以确保原子性]
    await this.db.transaction(async (tx) => {
      // 1. Query product item to get productId [查询产品项以获取产品ID]
      const [productItem] = await tx
        .select({ productId: schema.productItems.productId })
        .from(schema.productItems)
        .where(eq(schema.productItems.id, itemId))
        .limit(1);

      if (!productItem) {
        throw new CatalogNotFoundException("PRODUCT_ITEM_NOT_FOUND");
      }

      const productId = productItem.productId;

      // 2. Check if product exists and is draft with row lock [检查产品是否存在且为草稿状态，并加行锁]
      const [product] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .for("update") // Row-level lock to prevent concurrent modifications [行级锁防止并发修改]
        .limit(1);

      if (!product) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (product.status !== ProductStatus.DRAFT) {
        throw new CatalogException("PRODUCT_NOT_DRAFT");
      }

      // 3. Product must contain at least 1 item [产品必须至少包含一个项目]
      const items = await tx
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, productId));

      if (items.length <= 1) {
        throw new CatalogException("PRODUCT_MIN_ITEMS");
      }

      // 4. Delete product item [删除产品项]
      await tx
        .delete(schema.productItems)
        .where(eq(schema.productItems.id, itemId));
    });
  }

  /**
   * Update product item sort order (更新产品项排序顺序) [更新产品项排序]
   */
  async updateItemSortOrder(
    items: Array<{ itemId: string; sortOrder: number }>,
  ): Promise<void> {
    // Wrap operations in transaction to ensure atomicity [将操作包裹在事务中以确保原子性]
    await this.db.transaction(async (tx) => {
      // 1. Validate items array is not empty [验证 items 数组不为空]
      if (!items || items.length === 0) {
        throw new CatalogException("INVALID_INPUT", "Items array cannot be empty");
      }

      // 2. Query productId for all items [查询所有 items 的 productId]
      const itemIds = items.map((item) => item.itemId);
      const productItems = await tx
        .select({
          id: schema.productItems.id,
          productId: schema.productItems.productId,
        })
        .from(schema.productItems)
        .where(inArray(schema.productItems.id, itemIds));

      // 3. Validate all items exist [验证所有 items 都存在]
      if (productItems.length !== itemIds.length) {
        const foundIds = new Set(productItems.map((pi) => pi.id));
        const missingIds = itemIds.filter((id) => !foundIds.has(id));
        throw new CatalogNotFoundException("PRODUCT_ITEM_NOT_FOUND");
      }

      // 4. Validate all items belong to the same product [验证所有 items 属于同一个产品]
      const productIds = [...new Set(productItems.map((pi) => pi.productId))];
      if (productIds.length !== 1) {
        throw new CatalogException(
          "ITEMS_BELONG_TO_DIFFERENT_PRODUCTS",
          "All items must belong to the same product",
        );
      }

      const productId = productIds[0];

      // 5. Check if product exists and is draft with row lock [检查产品是否存在且为草稿状态，并加行锁]
      const [product] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .for("update") // Row-level lock to prevent concurrent modifications [行级锁防止并发修改]
        .limit(1);

      if (!product) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (product.status !== ProductStatus.DRAFT) {
        throw new CatalogException("PRODUCT_NOT_DRAFT");
      }

      // 6. Update sortOrder for each item [为每个项目更新排序]
      for (const item of items) {
        await tx
          .update(schema.productItems)
          .set({ sortOrder: item.sortOrder })
          .where(eq(schema.productItems.id, item.itemId));
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

    if (filter.userPersona) {
      // JSON array contains check
      conditions.push(
        sql`${schema.products.targetUserPersona}::jsonb @> ${JSON.stringify([filter.userPersona])}`,
      );
    }

    if (filter.marketingLabel) {
      // JSON array contains check
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
      .orderBy(schema.productItems.sortOrder, schema.productItems.createdAt); // Order by sortOrder, then createdAt as fallback [按 sortOrder 排序，createdAt 作为兜底]

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
   * - [修复] Enforces at least one product item before publishing [发布前强制要求至少一个产品项]
   * - Uses FOR UPDATE lock to prevent concurrent modifications [使用FOR UPDATE锁防止并发修改]
   *
   * @param id - Product ID [产品ID]
   * @returns Published product [发布的产品]
   */
  async publish(id: string): Promise<IProduct> {
    // Wrap in transaction with row lock to ensure atomicity [使用事务和行锁确保原子性]
    const updatedProduct = await this.db.transaction(async (tx) => {
      // Retrieve product with row lock [检索产品并加行锁]
      const [product] = await tx
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, id))
        .for("update")
        .limit(1);

      if (!product) {
        throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
      }

      if (product.status !== ProductStatus.DRAFT) {
        throw new CatalogException(
          "INVALID_STATUS_TRANSITION",
          `Cannot publish product. Product must be in DRAFT status, but current status is ${product.status}`,
        );
      }

      // [修复] Verify product has at least one item [验证产品至少有一个项目]
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

      // Validate product item references within transaction [在事务中验证产品项引用]
      const allItems = await tx
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, id));

      await this.validateProductItemReferences(allItems, tx);

      // Update product status [更新产品状态]
      const [updated] = await tx
        .update(schema.products)
        .set({
          status: ProductStatus.ACTIVE,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, id))
        .returning();

      return updated;
    });

    return this.mapToProductInterface(updatedProduct);
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
      throw new CatalogException(
        "INVALID_STATUS_TRANSITION",
        `Cannot unpublish product. Product must be in ACTIVE status, but current status is ${product.status}`,
      );
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
      throw new CatalogException(
        "INVALID_STATUS_TRANSITION",
        `Cannot revert product to draft. Product must be in INACTIVE status, but current status is ${product.status}`,
      );
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
      throw new CatalogException(
        "PRODUCT_NOT_PUBLISHED",
        `Cannot create snapshot. Product must be in ACTIVE status, but current status is ${product.status}`,
      );
    }

    // Create snapshot items [创建快照项]
    // 1. Collect all service type IDs [收集所有服务类型ID]
    const serviceTypeIds = product.items.map((item) => item.serviceTypeId);

    // 2. Batch query service types to get codes [批量查询服务类型以获取编码]
    const serviceTypes = await this.db
      .select({
        id: schema.serviceTypes.id,
        code: schema.serviceTypes.code,
      })
      .from(schema.serviceTypes)
      .where(inArray(schema.serviceTypes.id, serviceTypeIds));

    // 3. Create mapping: serviceTypeId -> code [创建映射：serviceTypeId -> code]
    const serviceTypeCodeMap = new Map(
      serviceTypes.map((st) => [st.id, st.code]),
    );

    // 4. Build snapshot items with serviceTypeCode [构建包含 serviceTypeCode 的快照项]
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
   * @param items - Product items to validate [要验证的产品项]
   * @param tx - Optional transaction context [可选的事务上下文]
   */
  private async validateProductItemReferences(
    items: Array<{ serviceTypeId: string } | IProductItem>,
    tx?: typeof this.db,
  ): Promise<void> {
    // Use transaction context if provided, otherwise use default db [如果提供了事务上下文则使用它，否则使用默认数据库]
    const dbContext = tx || this.db;

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
    const serviceTypes = await dbContext
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
