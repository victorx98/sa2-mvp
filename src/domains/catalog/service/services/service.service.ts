import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, or, like, ne, count, sql } from "drizzle-orm";
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
import { PaginatedResult } from "../../common/interfaces/paginated-result.interface";
import { CreateServiceDto } from "../dto/create-service.dto";
import { UpdateServiceDto } from "../dto/update-service.dto";
import { ServiceFilterDto } from "../dto/service-filter.dto";
import { FindOneServiceDto } from "../dto/find-one-service.dto";
import { IService } from "../interfaces/service.interface";
import { IServiceDetail } from "../interfaces/service-detail.interface";
import { IServiceSnapshot } from "../interfaces/service-snapshot.interface";
import {
  ServiceType,
  BillingMode,
  ServiceUnit,
  ServiceStatus,
} from "../../common/interfaces/enums";
import { buildLikePattern } from "../../common/utils/sql.utils";

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new service
   */
  async create(
    dto: CreateServiceDto,
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<IService> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Validate code uniqueness
    const existingByCode = await executor
      .select()
      .from(schema.services)
      .where(eq(schema.services.code, dto.code))
      .limit(1);

    if (existingByCode.length > 0) {
      throw new CatalogConflictException("SERVICE_CODE_DUPLICATE");
    }

    // 2. Validate serviceType uniqueness
    const existingByType = await executor
      .select()
      .from(schema.services)
      .where(eq(schema.services.serviceType, dto.serviceType))
      .limit(1);

    if (existingByType.length > 0) {
      throw new CatalogConflictException("SERVICE_TYPE_DUPLICATE");
    }

    // 3. Create service
    const [service] = await executor
      .insert(schema.services)
      .values({
        code: dto.code,
        serviceType: dto.serviceType,
        name: dto.name,
        description: dto.description,
        coverImage: dto.coverImage,
        billingMode: dto.billingMode,
        requiresEvaluation: dto.requiresEvaluation ?? false,
        requiresMentorAssignment: dto.requiresMentorAssignment ?? true,
        status: "active",
        metadata: dto.metadata,
        createdBy: userId,
      })
      .returning();

    return this.mapToServiceInterface(service);
  }

  /**
   * Update service information
   */
  async update(
    id: string,
    dto: UpdateServiceDto,
    tx?: DrizzleTransaction,
  ): Promise<IService> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service exists
    const existing = await executor
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("SERVICE_NOT_FOUND");
    }

    const service = existing[0];

    if (service.status === "deleted") {
      throw new CatalogGoneException("SERVICE_DELETED");
    }

    // 2. Check if service is referenced (warning, but allow update)
    await this.checkServiceReferences(id, true, tx);

    // 3. Update service
    const [updated] = await executor
      .update(schema.services)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(schema.services.id, id))
      .returning();

    return this.mapToServiceInterface(updated);
  }

  /**
   * Search services with pagination
   */
  async search(
    filter: ServiceFilterDto,
    pagination?: PaginationDto,
    sort?: SortDto,
  ): Promise<PaginatedResult<IService>> {
    // Build where conditions
    const conditions = [];

    // Exclude deleted status by default
    if (!filter.includeDeleted) {
      conditions.push(ne(schema.services.status, "deleted"));
    }

    if (filter.status) {
      conditions.push(eq(schema.services.status, filter.status));
    }

    if (filter.serviceType) {
      conditions.push(eq(schema.services.serviceType, filter.serviceType));
    }

    if (filter.billingMode) {
      conditions.push(eq(schema.services.billingMode, filter.billingMode));
    }

    if (filter.keyword) {
      const safeKeyword = buildLikePattern(filter.keyword);
      conditions.push(
        or(
          like(schema.services.name, safeKeyword),
          like(schema.services.code, safeKeyword),
          like(schema.services.description, safeKeyword),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query total count
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.services)
      .where(whereClause);

    // Return all data if no pagination parameters
    if (!pagination) {
      const allData = await this.db
        .select()
        .from(schema.services)
        .where(whereClause)
        .orderBy(this.getOrderBy(sort));

      return {
        data: allData.map(this.mapToServiceInterface),
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
      .from(schema.services)
      .where(whereClause)
      .orderBy(this.getOrderBy(sort))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map(this.mapToServiceInterface),
      total: Number(total),
      page,
      pageSize,
      totalPages: Math.ceil(Number(total) / pageSize),
    };
  }

  /**
   * Find one service by conditions
   */
  async findOne(where: FindOneServiceDto): Promise<IServiceDetail | null> {
    if (!where.id && !where.code) {
      throw new CatalogException("INVALID_QUERY");
    }

    const conditions = [];
    if (where.id) {
      conditions.push(eq(schema.services.id, where.id));
    }
    if (where.code) {
      conditions.push(eq(schema.services.code, where.code));
    }

    const result = await this.db
      .select()
      .from(schema.services)
      .where(and(...conditions))
      .limit(1);

    return result[0] ? this.mapToServiceInterface(result[0]) : null;
  }

  /**
   * Update service status
   */
  async updateStatus(
    id: string,
    status: "active" | "inactive",
    tx?: DrizzleTransaction,
  ): Promise<IService> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service exists
    const existing = await executor
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("SERVICE_NOT_FOUND");
    }

    const service = existing[0];

    if (service.status === "deleted") {
      throw new CatalogGoneException("SERVICE_DELETED");
    }

    // 2. Check if service is referenced when deactivating (warning)
    if (status === "inactive") {
      await this.checkServiceReferences(id, true, tx);
    }

    // 3. Update status
    const [updated] = await executor
      .update(schema.services)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.services.id, id))
      .returning();

    return this.mapToServiceInterface(updated);
  }

  /**
   * Soft delete service
   */
  async remove(id: string, tx?: DrizzleTransaction): Promise<IService> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service exists
    const existing = await executor
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("SERVICE_NOT_FOUND");
    }

    const service = existing[0];

    if (service.status === "deleted") {
      throw new CatalogGoneException("SERVICE_DELETED");
    }

    // 2. Cannot delete active service
    if (service.status === "active") {
      throw new CatalogException("SERVICE_ACTIVE_CANNOT_DELETE");
    }

    // 3. Check if service is referenced (not allowed to delete)
    await this.checkServiceReferences(id, false, tx);

    // 4. Soft delete
    const [deleted] = await executor
      .update(schema.services)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(eq(schema.services.id, id))
      .returning();

    return this.mapToServiceInterface(deleted);
  }

  /**
   * Restore deleted service
   */
  async restore(id: string, tx?: DrizzleTransaction): Promise<IService> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // 1. Check if service exists and is deleted
    const existing = await executor
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new CatalogNotFoundException("SERVICE_NOT_FOUND");
    }

    const service = existing[0];

    if (service.status !== "deleted") {
      throw new CatalogException("SERVICE_NOT_DELETED");
    }

    // 2. Restore to inactive status
    const [restored] = await executor
      .update(schema.services)
      .set({
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(eq(schema.services.id, id))
      .returning();

    return this.mapToServiceInterface(restored);
  }

  /**
   * Find all available services (excluding deleted)
   */
  async findAvailableServices(): Promise<IService[]> {
    const result = await this.db
      .select()
      .from(schema.services)
      .where(ne(schema.services.status, "deleted"))
      .orderBy(schema.services.name);

    return result.map(this.mapToServiceInterface);
  }

  /**
   * Generate service snapshot (for contract snapshot)
   */
  async generateSnapshot(id: string): Promise<IServiceSnapshot> {
    const service = await this.findOne({ id });

    if (!service) {
      throw new CatalogNotFoundException("SERVICE_NOT_FOUND");
    }

    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceCode: service.code,
      serviceType: service.serviceType,
      billingMode: service.billingMode,
      requiresEvaluation: service.requiresEvaluation,
      requiresMentorAssignment: service.requiresMentorAssignment,
      metadata: service.metadata,
      snapshotAt: new Date(),
    };
  }

  // ==================== Private helper methods ====================

  /**
   * Check if service is referenced
   * @param serviceId - Service ID
   * @param allowWarning - Whether to allow warning (if true, only warn without throwing exception)
   */
  private async checkServiceReferences(
    serviceId: string,
    allowWarning: boolean,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // Check service package references
    const packageRefs = await executor
      .select()
      .from(schema.servicePackageItems)
      .where(eq(schema.servicePackageItems.serviceId, serviceId))
      .limit(1);

    // Check product references
    const productRefs = await executor
      .select()
      .from(schema.productItems)
      .where(
        and(
          eq(schema.productItems.type, "service"),
          eq(schema.productItems.referenceId, serviceId),
        ),
      )
      .limit(1);

    const hasReferences = packageRefs.length > 0 || productRefs.length > 0;

    if (hasReferences) {
      if (allowWarning) {
        this.logger.warn(
          `Service ${serviceId} is being referenced, but operation is allowed with warning`,
        );
      } else {
        throw new CatalogException("SERVICE_IN_USE");
      }
    }
  }

  /**
   * Get order by clause
   */
  private getOrderBy(sort?: SortDto) {
    const field = sort?.field || "createdAt";
    const order = sort?.order || "desc";

    const column = schema.services[field] || schema.services.createdAt;
    return order === "asc" ? column : sql`${column} DESC`;
  }

  /**
   * Map database record to interface
   */
  private mapToServiceInterface(
    record: typeof schema.services.$inferSelect,
  ): IService {
    return {
      id: record.id,
      code: record.code,
      serviceType: record.serviceType as ServiceType,
      name: record.name,
      description: record.description,
      coverImage: record.coverImage,
      billingMode: record.billingMode as BillingMode,
      requiresEvaluation: record.requiresEvaluation,
      requiresMentorAssignment: record.requiresMentorAssignment,
      status: record.status as ServiceStatus,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };
  }
}
