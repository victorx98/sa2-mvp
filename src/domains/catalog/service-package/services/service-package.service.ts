import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, or, like, ne, count, sql, inArray } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { SortDto } from "../../common/dto/sort.dto";
import { PaginatedResult } from "@shared/types/paginated-result";
import { CreateServicePackageDto } from "../dto/create-service-package.dto";
import { UpdateServicePackageDto } from "../dto/update-service-package.dto";
import { AddServiceDto } from "../dto/add-service.dto";
import { PackageFilterDto } from "../dto/package-filter.dto";
import { FindOneServicePackageDto } from "../dto/find-one-service-package.dto";
import { IServicePackage } from "../interfaces/service-package.interface";
import { IServicePackageDetail } from "../interfaces/service-package-detail.interface";
import { IServicePackageSnapshot } from "../interfaces/service-package-snapshot.interface";
import { ServiceService } from "../../service/services/service.service";
import { buildLikePattern } from "../../common/utils/sql.utils";
import { ProductItemType, ServiceStatus } from "@shared/types/catalog-enums";

@Injectable()
export class ServicePackageService {
  private readonly logger = new Logger(ServicePackageService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly serviceService: ServiceService,
  ) { }

  /**
   * Create service package
   */
  async create(
    dto: CreateServicePackageDto,
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<IServicePackage> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Validate code uniqueness
    const existingByCode = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.code, dto.code))
      .limit(1);

    if (existingByCode.length > 0) {
      throw new CatalogConflictException("PACKAGE_CODE_DUPLICATE");
    }

    // 2. Validate service existence and status if items provided
    if (dto.items && dto.items.length > 0) {
      await this.validateServices(
        dto.items.map((item) => item.serviceId),
        tx,
      );
    }

    // 3. Use transaction to ensure atomicity
    const run = async (executor: DrizzleExecutor) => {
      // 3.1 Create service package
      const [newPackage] = await executor
        .insert(schema.servicePackages)
        .values({
          code: dto.code,
          name: dto.name,
          description: dto.description,
          coverImage: dto.coverImage,
          status: ServiceStatus.ACTIVE,
          metadata: dto.metadata,
          createdBy: userId,
        })
        .returning();

      // 3.2 Create service items if provided
      if (dto.items && dto.items.length > 0) {
        await executor.insert(schema.servicePackageItems).values(
          dto.items.map((item, index) => ({
            packageId: newPackage.id,
            serviceId: item.serviceId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        );
      }

      return newPackage;
    };

    const servicePackage = tx
      ? await run(tx)
      : await this.db.transaction(async (transaction) => run(transaction));

    return this.mapToServicePackageInterface(servicePackage);
  }

  /**
   * Update service package information
   */
  async update(
    id: string,
    dto: UpdateServicePackageDto,
    tx?: DrizzleTransaction,
  ): Promise<IServicePackage> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists
    const existing = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    const servicePackage = existing[0];

    if (servicePackage.status === "deleted") {
      throw new CatalogGoneException("PACKAGE_DELETED");
    }

    // 2. Check if referenced (warning, but allow update)
    await this.checkPackageReferences(id, true, tx);

    // 3. Update service package
    const [updated] = await executor
      .update(schema.servicePackages)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(schema.servicePackages.id, id))
      .returning();

    return this.mapToServicePackageInterface(updated);
  }

  /**
   * Add service to service package
   */
  async addService(
    packageId: string,
    dto: AddServiceDto,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists
    const pkg = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, packageId))
      .limit(1);

    if (pkg.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    if (pkg[0].status === "deleted") {
      throw new CatalogGoneException("PACKAGE_DELETED");
    }

    // 2. Validate service exists and status is active
    await this.validateServices([dto.serviceId], tx);

    // 3. Check if service already exists in package
    const existingItem = await executor
      .select()
      .from(schema.servicePackageItems)
      .where(
        and(
          eq(schema.servicePackageItems.packageId, packageId),
          eq(schema.servicePackageItems.serviceId, dto.serviceId),
        ),
      )
      .limit(1);

    if (existingItem.length > 0) {
      throw new CatalogException("SERVICE_ALREADY_IN_PACKAGE");
    }

    // 4. Add service item
    await executor.insert(schema.servicePackageItems).values({
      packageId,
      serviceId: dto.serviceId,
      quantity: dto.quantity,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  /**
   * Remove service from service package
   */
  async removeService(
    packageId: string,
    serviceId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists
    const pkg = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, packageId))
      .limit(1);

    if (pkg.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    // 2. Service package must contain at least 1 service
    const items = await executor
      .select()
      .from(schema.servicePackageItems)
      .where(eq(schema.servicePackageItems.packageId, packageId));

    if (items.length <= 1) {
      throw new CatalogException("PACKAGE_MIN_SERVICES");
    }

    // 3. Delete service item
    await executor
      .delete(schema.servicePackageItems)
      .where(
        and(
          eq(schema.servicePackageItems.packageId, packageId),
          eq(schema.servicePackageItems.serviceId, serviceId),
        ),
      );
  }

  /**
   * Update service item sort order in package
   */
  async updateItemSortOrder(
    packageId: string,
    items: Array<{ itemId: string; sortOrder: number }>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists
    const pkg = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, packageId))
      .limit(1);

    if (pkg.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    // 2. Batch update sort order with transaction protection
    const run = async (runner: DrizzleExecutor) => {
      for (const item of items) {
        await runner
          .update(schema.servicePackageItems)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(schema.servicePackageItems.id, item.itemId),
              eq(schema.servicePackageItems.packageId, packageId),
            ),
          );
      }
    };

    if (tx) {
      await run(tx);
      return;
    }

    await this.db.transaction(async (transaction) => {
      await run(transaction);
    });
  }

  /**
   * Search service packages with pagination
   */
  async search(
    filter: PackageFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IServicePackage>> {
    // Build where conditions
    const conditions = [];

    // Exclude deleted status by default
    if (!filter.includeDeleted) {
      conditions.push(ne(schema.servicePackages.status, ServiceStatus.DELETED));
    }

    if (filter.status) {
      conditions.push(eq(schema.servicePackages.status, filter.status));
    }

    if (filter.keyword) {
      const safeKeyword = buildLikePattern(filter.keyword);
      conditions.push(
        or(
          like(schema.servicePackages.name, safeKeyword),
          like(schema.servicePackages.code, safeKeyword),
          like(schema.servicePackages.description, safeKeyword),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query total count
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.servicePackages)
      .where(whereClause);

    // Return all data if no pagination parameters
    if (!pagination) {
      const allData = await this.db
        .select()
        .from(schema.servicePackages)
        .where(whereClause)
        .orderBy(this.getOrderBy(sort));

      return {
        data: allData.map(this.mapToServicePackageInterface),
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
      .from(schema.servicePackages)
      .where(whereClause)
      .orderBy(this.getOrderBy(sort))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map(this.mapToServicePackageInterface),
      total: Number(total),
      page,
      pageSize,
      totalPages: Math.ceil(Number(total) / pageSize),
    };
  }

  /**
   * Find one service package by conditions
   */
  async findOne(
    where: FindOneServicePackageDto,
  ): Promise<IServicePackageDetail | null> {
    if (!where.id && !where.code) {
      throw new CatalogException("INVALID_QUERY");
    }

    const conditions = [];
    if (where.id) {
      conditions.push(eq(schema.servicePackages.id, where.id));
    }
    if (where.code) {
      conditions.push(eq(schema.servicePackages.code, where.code));
    }

    // Exclude deleted packages from normal queries
    conditions.push(ne(schema.servicePackages.status, ServiceStatus.DELETED));

    const result = await this.db
      .select()
      .from(schema.servicePackages)
      .where(and(...conditions))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const pkg = result[0];

    // Get service items
    const items = await this.db
      .select()
      .from(schema.servicePackageItems)
      .where(eq(schema.servicePackageItems.packageId, pkg.id))
      .orderBy(schema.servicePackageItems.sortOrder);

    // Get associated service information
    const serviceIds = items.map((item) => item.serviceId);
    const servicesData =
      serviceIds.length > 0
        ? await this.db
          .select()
          .from(schema.services)
          .where(inArray(schema.services.id, serviceIds))
        : [];

    const servicesMap = new Map(servicesData.map((s) => [s.id, s]));

    return {
      ...this.mapToServicePackageInterface(pkg),
      items: items.map((item) => {
        const serviceData = servicesMap.get(item.serviceId);
        return {
          id: item.id,
          serviceId: item.serviceId,
          quantity: item.quantity,
          sortOrder: item.sortOrder,
          service: serviceData
            ? this.mapServiceToInterface(serviceData)
            : undefined,
        };
      }),
    };
  }

  /**
   * Update service package status
   */
  async updateStatus(
    id: string,
    status: ServiceStatus,
    tx?: DrizzleTransaction,
  ): Promise<IServicePackage> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists
    const existing = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    const pkg = existing[0];

    if (pkg.status === "deleted") {
      throw new CatalogGoneException("PACKAGE_DELETED");
    }

    // 2. Check if referenced when deactivating (warning)
    if (status === "inactive") {
      await this.checkPackageReferences(id, true, tx);
    }

    // 3. Update status
    const [updated] = await executor
      .update(schema.servicePackages)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.servicePackages.id, id))
      .returning();

    return this.mapToServicePackageInterface(updated);
  }

  /**
   * Soft delete service package
   */
  async remove(id: string, tx?: DrizzleTransaction): Promise<IServicePackage> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists
    const existing = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    const pkg = existing[0];

    if (pkg.status === "deleted") {
      throw new CatalogGoneException("PACKAGE_DELETED");
    }

    // 2. Cannot delete active service package
    if (pkg.status === "active") {
      throw new CatalogException("PACKAGE_ACTIVE_CANNOT_DELETE");
    }

    // 3. Check if referenced (not allowed to delete)
    await this.checkPackageReferences(id, false, tx);

    // 4. Soft delete
    const [deleted] = await executor
      .update(schema.servicePackages)
      .set({
        status: ServiceStatus.DELETED,
        updatedAt: new Date(),
      })
      .where(eq(schema.servicePackages.id, id))
      .returning();

    return this.mapToServicePackageInterface(deleted);
  }

  /**
   * Restore deleted service package
   */
  async restore(id: string, tx?: DrizzleTransaction): Promise<IServicePackage> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service package exists and is deleted
    const existing = await executor
      .select()
      .from(schema.servicePackages)
      .where(eq(schema.servicePackages.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    const pkg = existing[0];

    if (pkg.status !== "deleted") {
      throw new CatalogException("PACKAGE_NOT_DELETED");
    }

    // 2. Restore to inactive status
    const [restored] = await executor
      .update(schema.servicePackages)
      .set({
        status: ServiceStatus.INACTIVE,
        updatedAt: new Date(),
      })
      .where(eq(schema.servicePackages.id, id))
      .returning();

    return this.mapToServicePackageInterface(restored);
  }

  /**
   * Generate service package snapshot (expand services for contract snapshot)
   */
  async generateSnapshot(id: string): Promise<IServicePackageSnapshot> {
    const pkg = await this.findOne({ id });

    if (!pkg) {
      throw new CatalogNotFoundException("PACKAGE_NOT_FOUND");
    }

    // Generate snapshot for each service
    const items = await Promise.all(
      (pkg.items || []).map(async (item) => {
        const serviceSnapshot = await this.serviceService.generateSnapshot(
          item.serviceId,
        );
        return {
          serviceSnapshot,
          quantity: item.quantity,
          sortOrder: item.sortOrder,
        };
      }),
    );

    return {
      packageId: pkg.id,
      packageName: pkg.name,
      packageCode: pkg.code,
      items,
      snapshotAt: new Date(),
    };
  }

  // ==================== Private helper methods ====================

  /**
   * Validate services exist and status is active (optimized to avoid N+1 queries)
   */
  private async validateServices(
    serviceIds: string[],
    tx?: DrizzleTransaction,
  ): Promise<void> {
    if (serviceIds.length === 0) {
      return;
    }

    // Batch fetch all services at once
    const executor: DrizzleExecutor = tx ?? this.db;

    const servicesData = await executor
      .select()
      .from(schema.services)
      .where(inArray(schema.services.id, serviceIds));

    // Create map for O(1) lookup
    const servicesMap = new Map(servicesData.map((s) => [s.id, s]));

    // Validate each service
    for (const serviceId of serviceIds) {
      const service = servicesMap.get(serviceId);

      if (!service) {
        throw new CatalogNotFoundException("REFERENCE_NOT_FOUND");
      }

      if (service.status !== "active") {
        throw new CatalogException("REFERENCE_NOT_ACTIVE");
      }
    }
  }

  /**
   * Check if service package is referenced
   */
  private async checkPackageReferences(
    packageId: string,
    allowWarning: boolean,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    // Check product references
    const executor: DrizzleExecutor = tx ?? this.db;

    const productRefs = await executor
      .select()
      .from(schema.productItems)
      .where(
        and(
          eq(schema.productItems.type, ProductItemType.SERVICE_PACKAGE),
          eq(schema.productItems.referenceId, packageId),
        ),
      )
      .limit(1);

    const hasReferences = productRefs.length > 0;

    if (hasReferences) {
      if (allowWarning) {
        this.logger.warn(
          `ServicePackage ${packageId} is being referenced, but operation is allowed with warning`,
        );
      } else {
        throw new CatalogException("PACKAGE_IN_USE");
      }
    }
  }

  /**
   * Get order by clause
   */
  private getOrderBy(sort?: SortDto) {
    const field = sort?.field || "createdAt";
    const order = sort?.order || "desc";

    const column =
      schema.servicePackages[field] || schema.servicePackages.createdAt;
    return order === "asc" ? column : sql`${column} DESC`;
  }

  /**
   * Map database record to interface
   */
  private mapToServicePackageInterface(
    record: typeof schema.servicePackages.$inferSelect,
  ): IServicePackage {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      coverImage: record.coverImage,
      status: record.status,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };
  }

  /**
   * Map service database record to interface
   */
  private mapServiceToInterface(record: typeof schema.services.$inferSelect) {
    return {
      id: record.id,
      code: record.code,
      serviceType: record.serviceType,
      name: record.name,
      description: record.description,
      coverImage: record.coverImage,
      billingMode: record.billingMode, // [修复] 明确转换为BillingMode枚举类型
      requiresEvaluation: record.requiresEvaluation,
      requiresMentorAssignment: record.requiresMentorAssignment,
      status: record.status,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };
  }
}
