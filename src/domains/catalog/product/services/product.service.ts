import { Inject, Injectable } from "@nestjs/common";
import { eq, and, or, like, ne, count, sql, inArray } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { Service, ServicePackage } from "@infrastructure/database/schema";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { SortDto } from "../../common/dto/sort.dto";
import { PaginatedResult } from "../../common/interfaces/paginated-result.interface";
import { CreateProductDto } from "../dto/create-product.dto";
import { UpdateProductDto } from "../dto/update-product.dto";
import { AddProductItemDto } from "../dto/add-product-item.dto";
import { PublishProductDto } from "../dto/publish-product.dto";
import { ProductFilterDto } from "../dto/product-filter.dto";
import { FindOneProductDto } from "../dto/find-one-product.dto";

import { IProduct } from "../interfaces/product.interface";
import { IProductDetail } from "../interfaces/product-detail.interface";
import { IProductSnapshot } from "../interfaces/product-snapshot.interface";
import type { IService } from "../../service/interfaces/service.interface";
import type { IServicePackage } from "../../service-package/interfaces/service-package.interface";
import { ProductStatus, ProductItemType } from "../../common/interfaces/enums";
import { ServiceService } from "../../service/services/service.service";
import { ServicePackageService } from "../../service-package/services/service-package.service";
import { buildLikePattern } from "../../common/utils/sql.utils";

@Injectable()
export class ProductService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly serviceService: ServiceService,
    private readonly servicePackageService: ServicePackageService,
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

    if (
      dto.validityDays !== undefined &&
      dto.validityDays !== null &&
      dto.validityDays <= 0
    ) {
      throw new CatalogException("INVALID_VALIDITY_DAYS");
    }

    // 3. Validate item references if provided
    if (dto.items && dto.items.length > 0) {
      await this.validateProductItems(dto.items);
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
          targetUserTypes: dto.targetUserTypes ? dto.targetUserTypes : null,
          price: dto.price.toString(),
          currency: dto.currency || "USD",
          validityDays: dto.validityDays,
          marketingLabels: dto.marketingLabels ? dto.marketingLabels : null,
          status: "draft",
          metadata: dto.metadata ? dto.metadata : null,
          createdBy: userId,
        })
        .returning();

      // 4.2 Create item records if provided
      if (dto.items && dto.items.length > 0) {
        await tx.insert(schema.productItems).values(
          dto.items.map((item, index) => ({
            productId: newProduct.id,
            type: item.type,
            referenceId: item.referenceId,
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
   * Update unpublished draft product
   */
  async update(id: string, dto: UpdateProductDto): Promise<IProduct> {
    // 1. Check if product exists
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status === "deleted") {
      throw new CatalogGoneException("PRODUCT_DELETED");
    }

    // 2. Can only update unpublished draft products
    if (product.publishedAt !== null) {
      throw new CatalogException("PRODUCT_ALREADY_PUBLISHED");
    }

    // 3. Validate price and validity days
    if (dto.price !== undefined && dto.price <= 0) {
      throw new CatalogException("INVALID_PRICE");
    }

    if (
      dto.validityDays !== undefined &&
      dto.validityDays !== null &&
      dto.validityDays <= 0
    ) {
      throw new CatalogException("INVALID_VALIDITY_DAYS");
    }

    // 4. Update product
    const [updated] = await this.db
      .update(schema.products)
      .set({
        ...dto,
        price: dto.price !== undefined ? dto.price.toString() : undefined,
        targetUserTypes: dto.targetUserTypes ? dto.targetUserTypes : undefined,
        marketingLabels: dto.marketingLabels ? dto.marketingLabels : undefined,
        metadata: dto.metadata ? dto.metadata : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(updated);
  }

  /**
   * Add service or service package to product
   */
  async addItem(productId: string, dto: AddProductItemDto): Promise<void> {
    // 1. Check if product exists and is draft
    const product = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (product.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product[0].status !== "draft") {
      throw new CatalogException("PRODUCT_NOT_DRAFT");
    }

    // 2. Validate reference exists and is active
    await this.validateProductItems([dto]);

    // 3. Service package quantity must be 1
    if (dto.type === "service_package" && dto.quantity !== 1) {
      throw new CatalogException("PACKAGE_QUANTITY_MUST_BE_ONE");
    }

    // 4. Check if already exists
    const existingItem = await this.db
      .select()
      .from(schema.productItems)
      .where(
        and(
          eq(schema.productItems.productId, productId),
          eq(schema.productItems.type, dto.type),
          eq(schema.productItems.referenceId, dto.referenceId),
        ),
      )
      .limit(1);

    if (existingItem.length > 0) {
      throw new CatalogException("ITEM_ALREADY_IN_PRODUCT");
    }

    // 5. Add product item
    await this.db.insert(schema.productItems).values({
      productId,
      type: dto.type,
      referenceId: dto.referenceId,
      quantity: dto.quantity,
      sortOrder: dto.sortOrder ?? 0,
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
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    if (product[0].status !== "draft") {
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
   * Update product item sort order
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
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    // 2. Batch update sort order with transaction protection
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
      conditions.push(ne(schema.products.status, "deleted"));
    }

    if (filter.status) {
      conditions.push(eq(schema.products.status, filter.status));
    }

    if (filter.userType) {
      // JSON array contains check
      conditions.push(
        sql`${schema.products.targetUserTypes}::jsonb @> ${JSON.stringify([filter.userType])}`,
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
    const { page = 1, pageSize = 20 } = pagination;
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
      .orderBy(schema.productItems.sortOrder);

    // Get associated services and packages
    const serviceIds = items
      .filter((item) => item.type === "service")
      .map((item) => item.referenceId);
    const packageIds = items
      .filter((item) => item.type === "service_package")
      .map((item) => item.referenceId);

    const [servicesData, packagesData] = await Promise.all([
      serviceIds.length > 0
        ? this.db
            .select()
            .from(schema.services)
            .where(inArray(schema.services.id, serviceIds))
        : [],
      packageIds.length > 0
        ? this.db
            .select()
            .from(schema.servicePackages)
            .where(inArray(schema.servicePackages.id, packageIds))
        : [],
    ]);

    const servicesMap = new Map(
      servicesData.map((s: Service) => [s.id, s] as [string, Service]),
    );

    const packagesMap = new Map(
      packagesData.map(
        (p: ServicePackage) => [p.id, p] as [string, ServicePackage],
      ),
    );

    return {
      ...this.mapToProductInterface(product),
      items: items.map((item) => ({
        id: item.id,
        type: item.type as ProductItemType,
        referenceId: item.referenceId,
        quantity: item.quantity,
        sortOrder: item.sortOrder,

        service:
          item.type === "service"
            ? (servicesMap.get(item.referenceId) as unknown as IService)
            : undefined,

        servicePackage:
          item.type === "service_package"
            ? (packagesMap.get(item.referenceId) as unknown as IServicePackage)
            : undefined,
      })),
    };
  }

  /**
   * Publish product
   */
  async publish(
    id: string,
    dto: PublishProductDto,
    userId: string,
  ): Promise<IProduct> {
    // 1. Check if product exists
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status !== "draft") {
      throw new CatalogException("PRODUCT_NOT_DRAFT");
    }

    // 2. Check product contains at least 1 item
    const items = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, id))
      .limit(1);

    if (items.length === 0) {
      throw new CatalogException("PRODUCT_NO_ITEMS");
    }

    // 3. Check all referenced services and packages are active (optimized batch query)
    const allItems = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, id));

    // Batch fetch all services and packages
    const serviceIds = allItems
      .filter((item) => item.type === "service")
      .map((item) => item.referenceId);
    const packageIds = allItems
      .filter((item) => item.type === "service_package")
      .map((item) => item.referenceId);

    const [servicesData, packagesData] = await Promise.all([
      serviceIds.length > 0
        ? this.db
            .select()
            .from(schema.services)
            .where(inArray(schema.services.id, serviceIds))
        : [],
      packageIds.length > 0
        ? this.db
            .select()
            .from(schema.servicePackages)
            .where(inArray(schema.servicePackages.id, packageIds))
        : [],
    ]);

    // Create maps for O(1) lookup

    const servicesMap = new Map(
      servicesData.map((s: Service) => [s.id, s] as [string, Service]),
    );

    const packagesMap = new Map(
      packagesData.map(
        (p: ServicePackage) => [p.id, p] as [string, ServicePackage],
      ),
    );

    // Validate all items
    for (const item of allItems) {
      if (item.type === "service") {
        const service = servicesMap.get(item.referenceId);
        if (!service || service.status !== "active") {
          throw new CatalogException("REFERENCE_NOT_ACTIVE");
        }
      } else if (item.type === "service_package") {
        const pkg = packagesMap.get(item.referenceId);
        if (!pkg || pkg.status !== "active") {
          throw new CatalogException("REFERENCE_NOT_ACTIVE");
        }
      }
    }

    // 4. Publish product
    // If publishAt is in the future, schedule the publish; otherwise, publish immediately
    const scheduledPublishAt = dto.publishAt ? new Date(dto.publishAt) : null;
    const isFuturePublish =
      scheduledPublishAt && scheduledPublishAt > new Date();

    const [published] = await this.db
      .update(schema.products)
      .set({
        status: isFuturePublish ? "draft" : "active",
        scheduledPublishAt,
        publishedAt: isFuturePublish ? null : new Date(),
        publishedBy: isFuturePublish ? null : userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(published);
  }

  /**
   * Unpublish product
   */
  async unpublish(
    id: string,
    reason: string,
    userId: string,
  ): Promise<IProduct> {
    if (!reason) {
      throw new CatalogException("REASON_REQUIRED");
    }

    // 1. Check if product exists
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status !== "active") {
      throw new CatalogException("PRODUCT_NOT_ACTIVE");
    }

    // 2. Unpublish product
    const [unpublished] = await this.db
      .update(schema.products)
      .set({
        status: "inactive",
        unpublishedAt: new Date(),
        unpublishedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(unpublished);
  }

  /**
   * Revert inactive product to draft
   */
  async revertToDraft(id: string): Promise<IProduct> {
    // 1. Check if product exists
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status !== "inactive") {
      throw new CatalogException("PRODUCT_NOT_INACTIVE");
    }

    // 2. Revert to draft
    const [reverted] = await this.db
      .update(schema.products)
      .set({
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(reverted);
  }

  /**
   * Soft delete product (unpublished drafts only)
   */
  async remove(id: string): Promise<IProduct> {
    // 1. Check if product exists
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status === "deleted") {
      throw new CatalogGoneException("PRODUCT_DELETED");
    }

    // 2. Can only delete unpublished draft products
    if (product.publishedAt !== null) {
      throw new CatalogException("PRODUCT_ALREADY_PUBLISHED");
    }

    // 3. Soft delete
    const [deleted] = await this.db
      .update(schema.products)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(deleted);
  }

  /**
   * Restore deleted product
   */
  async restore(id: string): Promise<IProduct> {
    // 1. Check if product exists and is deleted
    const existing = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    const product = existing[0];

    if (product.status !== "deleted") {
      throw new CatalogException("PRODUCT_NOT_DELETED");
    }

    // 2. Restore to draft status
    const [restored] = await this.db
      .update(schema.products)
      .set({
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();

    return this.mapToProductInterface(restored);
  }



  /**
   * Batch update product sort order
   */
  async updateProductSortOrder(
    updates: Array<{ productId: string; sortOrder: number }>,
  ): Promise<void> {
    // Use transaction to ensure atomicity
    await this.db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(schema.products)
          .set({ sortOrder: update.sortOrder })
          .where(eq(schema.products.id, update.productId));
      }
    });
  }

  /**
   * Generate product snapshot (expand packages for contract)
   */
  async generateSnapshot(id: string): Promise<IProductSnapshot> {
    const product = await this.findOne({ id });

    if (!product) {
      throw new CatalogNotFoundException("PRODUCT_NOT_FOUND");
    }

    // Generate snapshot for each product item
    const items = await Promise.all(
      (product.items || []).map(async (item) => {
        if (item.type === "service") {
          const serviceSnapshot = await this.serviceService.generateSnapshot(
            item.referenceId,
          );
          return {
            type: item.type,
            quantity: item.quantity,
            sortOrder: item.sortOrder,
            serviceSnapshot,
          };
        } else {
          const packageSnapshot =
            await this.servicePackageService.generateSnapshot(item.referenceId);
          return {
            type: item.type,
            quantity: item.quantity,
            sortOrder: item.sortOrder,
            servicePackageSnapshot: packageSnapshot,
          };
        }
      }),
    );

    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      price: product.price,
      currency: product.currency,
      validityDays: product.validityDays,
      items,
      snapshotAt: new Date(),
    };
  }

  // ==================== Private helper methods ====================

  /**
   * Validate product item references (optimized to avoid N+1 queries)
   */
  private async validateProductItems(
    items: Array<{
      type: ProductItemType;
      referenceId: string;
      quantity: number;
    }>,
  ): Promise<void> {
    // 1. Validate quantities first
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new CatalogException("INVALID_QUANTITY");
      }

      // Service package quantity must be 1
      if (item.type === "service_package" && item.quantity !== 1) {
        throw new CatalogException("PACKAGE_QUANTITY_MUST_BE_ONE");
      }
    }

    // 2. Batch query: Collect all IDs by type
    const serviceIds = items
      .filter((i) => i.type === "service")
      .map((i) => i.referenceId);
    const packageIds = items
      .filter((i) => i.type === "service_package")
      .map((i) => i.referenceId);

    // 3. Batch fetch all services and packages in parallel
    const [servicesData, packagesData] = await Promise.all([
      serviceIds.length > 0
        ? this.db
            .select()
            .from(schema.services)
            .where(inArray(schema.services.id, serviceIds))
        : [],
      packageIds.length > 0
        ? this.db
            .select()
            .from(schema.servicePackages)
            .where(inArray(schema.servicePackages.id, packageIds))
        : [],
    ]);

    // 4. Create maps for O(1) lookup

    const servicesMap = new Map(
      servicesData.map((s: Service) => [s.id, s] as [string, Service]),
    );

    const packagesMap = new Map(
      packagesData.map(
        (p: ServicePackage) => [p.id, p] as [string, ServicePackage],
      ),
    );

    // 5. Validate each item
    for (const item of items) {
      if (item.type === "service") {
        const service = servicesMap.get(item.referenceId);
        if (!service) {
          throw new CatalogNotFoundException("REFERENCE_NOT_FOUND");
        }
        if (service.status !== "active") {
          throw new CatalogException("REFERENCE_NOT_ACTIVE");
        }
      } else if (item.type === "service_package") {
        const pkg = packagesMap.get(item.referenceId);
        if (!pkg) {
          throw new CatalogNotFoundException("REFERENCE_NOT_FOUND");
        }
        if (pkg.status !== "active") {
          throw new CatalogException("REFERENCE_NOT_ACTIVE");
        }
      }
    }
  }

  /**
   * Get order by clause
   */
  private getOrderBy(sort?: SortDto) {
    const field = sort?.field || "sortOrder";
    const order = sort?.order || "asc";

    const column = schema.products[field] || schema.products.sortOrder;
    return order === "asc" ? column : sql`${column} DESC`;
  }

  /**
   * Map database record to interface
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetUserTypes: record.targetUserTypes as any,
      price: record.price,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currency: record.currency as any,
      validityDays: record.validityDays,
      marketingLabels: record.marketingLabels,
      status: record.status as ProductStatus,
      scheduledPublishAt: record.scheduledPublishAt,
      publishedAt: record.publishedAt,
      unpublishedAt: record.unpublishedAt,
      sortOrder: record.sortOrder,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      publishedBy: record.publishedBy,
      unpublishedBy: record.unpublishedBy,
    };
  }
}
