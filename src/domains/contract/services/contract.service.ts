import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, SQL, gte, lte, inArray, asc, desc } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { DrizzleDatabase } from "@shared/types/database.types";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";
import { CreateContractDto } from "../dto/create-contract.dto";
import { UpdateContractDto } from "../dto/update-contract.dto";
import { FindOneContractDto } from "../dto/find-one-contract.dto";
import { ConsumeServiceDto } from "../dto/consume-service.dto";
import { AddAmendmentLedgerDto } from "../dto/add-amendment-ledger.dto";
import {
  validatePrice,
  validateProductSnapshot,
  validateProductSnapshotMatch,
} from "../common/utils/validation.utils";
import type { Contract } from "@infrastructure/database/schema";
import type {
  IProductSnapshot,
  IGenerateContractNumberResult,
} from "../common/types/snapshot.types";
import type { ContractServiceEntitlement } from "@infrastructure/database/schema";
import { ContractStatus, HoldStatus } from "@shared/types/contract-enums";
import { Currency } from "@shared/types/catalog-enums";

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Record status change in history table (在历史表中记录状态变更)
   *
   * @param contractId Contract ID (合同ID)
   * @param fromStatus Previous status, null for initial state (变更前状态，初始状态为null)
   * @param toStatus New status (变更后状态)
   * @param changedBy User ID who made the change (变更操作人用户ID)
   * @param reason Reason for status change (optional) (变更原因（可选）)
   * @param metadata Additional metadata (optional) (额外元数据（可选）)
   */
  private async recordStatusChange(
    contractId: string,
    fromStatus: ContractStatus | null,
    toStatus: ContractStatus,
    changedBy?: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(schema.contractStatusHistory).values({
      contractId,
      fromStatus: fromStatus || null,
      toStatus,
      changedAt: new Date(),
      changedBy: changedBy || null,
      reason: reason || null,
      metadata: metadata || {},
    });
  }

  /**
   * Apply status change to contract (应用状态变更到合同)
   *
   * @param tx Database transaction (数据库事务)
   * @param contractId Contract ID (合同ID)
   * @param fromStatus Previous status (变更前状态)
   * @param toStatus Target status (目标状态)
   * @param changedBy User ID who made the change (变更操作人用户ID)
   * @param reason Reason for status change (optional) (变更原因（可选）)
   * @returns Updated contract (更新后的合同)
   */
  private async applyStatusChange(
    tx: DrizzleDatabase,
    contractId: string,
    fromStatus: ContractStatus,
    toStatus: ContractStatus,
    changedBy: string | null,
    reason?: string | null,
  ): Promise<Contract> {
    const [updatedContract] = await tx
      .update(schema.contracts)
      .set({
        status: toStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.contracts.id, contractId))
      .returning();

    await tx.insert(schema.contractStatusHistory).values({
      contractId,
      fromStatus,
      toStatus,
      changedAt: new Date(),
      changedBy,
      reason: reason || null,
      metadata: {},
    });

    return updatedContract;
  }

  /**
   * Create service entitlements from product snapshot (从产品快照创建服务权益)
   *
   * @param contract Contract entity with product snapshot (包含产品快照的合同实体)
   * @param tx Database transaction (数据库事务)
   */
  private async createEntitlementsFromSnapshot(
    contract: Contract,
    tx: DrizzleDatabase,
  ): Promise<void> {
    const productSnapshot = contract.productSnapshot as IProductSnapshot;
    const items = productSnapshot.items || [];

    if (items.length > 0) {
      const serviceTypeCodes = items
        .map((item) => item.serviceTypeCode)
        .filter(Boolean);

      const serviceTypesResult = await tx
        .select({
          code: schema.serviceTypes.code,
        })
        .from(schema.serviceTypes)
        .where(
          serviceTypeCodes.length > 0
            ? inArray(schema.serviceTypes.code, serviceTypeCodes)
            : undefined,
        );

      const validServiceTypeCodes = new Set(
        serviceTypesResult.map((st) => st.code),
      );

      const quantitiesByServiceType = new Map<string, number>();
      for (const item of items) {
        const serviceTypeCode = item.serviceTypeCode;
        if (!validServiceTypeCodes.has(serviceTypeCode)) {
          throw new ContractException("SERVICE_TYPE_NOT_FOUND");
        }
        const currentQty = quantitiesByServiceType.get(serviceTypeCode) || 0;
        quantitiesByServiceType.set(
          serviceTypeCode,
          currentQty + (item.quantity || 1),
        );
      }

      const insertValues = [];
      for (const [serviceType, quantity] of quantitiesByServiceType) {
        insertValues.push({
          studentId: contract.studentId,
          serviceType,
          totalQuantity: quantity,
          availableQuantity: quantity,
          createdBy: contract.createdBy,
        });
      }

      if (insertValues.length > 0) {
        await tx
          .insert(schema.contractServiceEntitlements)
          .values(insertValues)
          .onConflictDoUpdate({
            target: [
              schema.contractServiceEntitlements.studentId,
              schema.contractServiceEntitlements.serviceType,
            ],
            set: {
              totalQuantity: sql`${schema.contractServiceEntitlements.totalQuantity} + EXCLUDED.total_quantity`,
              availableQuantity: sql`(${schema.contractServiceEntitlements.totalQuantity} + EXCLUDED.total_quantity) - ${schema.contractServiceEntitlements.consumedQuantity} - ${schema.contractServiceEntitlements.heldQuantity}`,
              updatedAt: new Date(),
            },
          });
      }
    } else {
      throw new ContractException(
        "PRODUCT_SNAPSHOT_NO_ITEMS",
        "Product snapshot has no items. This should have been caught during validation.",
      );
    }
  }

  /**
   * Create contract (创建合约)
   * - Generate unique contract number (生成唯一合约编号)
   * - Create contract record (创建合约记录)
   * - Derive service entitlements from product snapshot (从产品快照派生服务权益)
   */
  async create(
    dto: CreateContractDto & { createdBy: string },
  ): Promise<Contract> {
    const { productSnapshot, studentId, createdBy, title, productId } = dto;

    validateProductSnapshot(productSnapshot);

    const [productDetails] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!productDetails) {
      throw new ContractException("PRODUCT_NOT_FOUND", "Product not found");
    }

    if (productDetails.status !== "ACTIVE") {
      throw new ContractException(
        "PRODUCT_NOT_ACTIVE",
        `Product must be ACTIVE to create contract. Current status: ${productDetails.status}`,
      );
    }

    const productItems = await this.db
      .select({
        id: schema.productItems.id,
        productId: schema.productItems.productId,
        serviceTypeId: schema.productItems.serviceTypeId,
        quantity: schema.productItems.quantity,
        sortOrder: schema.productItems.sortOrder,
        serviceTypeCode: schema.serviceTypes.code,
      })
      .from(schema.productItems)
      .leftJoin(
        schema.serviceTypes,
        eq(schema.productItems.serviceTypeId, schema.serviceTypes.id),
      )
      .where(eq(schema.productItems.productId, productId))
      .orderBy(schema.productItems.sortOrder);

    if (productItems.length === 0) {
      throw new ContractException(
        "PRODUCT_MIN_ITEMS",
        "Product must have at least one item to create contract",
      );
    }

    validateProductSnapshotMatch(
      productSnapshot,
      productId,
      productDetails.price,
      productDetails.currency,
    );

    const initialStatus = dto.status || ContractStatus.DRAFT;
    if (
      initialStatus !== ContractStatus.DRAFT &&
      initialStatus !== ContractStatus.SIGNED
    ) {
      throw new ContractException(
        "INVALID_INITIAL_STATUS",
        "Initial contract status must be DRAFT or SIGNED",
      );
    }

    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (
      contractNumberResult.rows[0] as unknown as IGenerateContractNumberResult
    ).contract_number;

    return await this.db.transaction(async (tx) => {
      const [newContract] = await tx
        .insert(schema.contracts)
        .values({
          contractNumber,
          title: title || productDetails.name,
          studentId,
          productId: productId,
          productSnapshot: {
            productId: productDetails.id,
            productName: productDetails.name,
            productCode: productDetails.code,
            price: productDetails.price.toString(),
            currency: productDetails.currency,
            items: productItems.map((item) => ({
              productItemId: item.id,
              serviceTypeCode: item.serviceTypeCode || "",
              quantity: item.quantity,
              sortOrder: item.sortOrder,
            })),
            snapshotAt: new Date(),
          },
          status: initialStatus,
          totalAmount: productDetails.price.toString(),
          currency: productDetails.currency as Currency,
          createdBy,
        })
        .returning();

      await this.createEntitlementsFromSnapshot(newContract, tx);

      if (initialStatus !== ContractStatus.DRAFT) {
        await tx.insert(schema.contractStatusHistory).values({
          contractId: newContract.id,
          fromStatus: ContractStatus.DRAFT,
          toStatus: initialStatus,
          changedAt: new Date(),
          changedBy: createdBy,
          reason: null,
          metadata: {},
        });
      }

      return newContract;
    });
  }

  /**
   * Find one contract (查找单个合约)
   * Supports multiple query methods with priority: contractId > contractNumber > studentId + status (支持多种查询方式，优先级为：合约ID > 合约编号 > 学生ID+状态)
   */
  async findOne(filter: FindOneContractDto): Promise<Contract | null> {
    const { contractId, contractNumber, studentId, status, productId } = filter;

    if (contractId) {
      const [contract] = await this.db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);
      return contract || null;
    }

    if (contractNumber) {
      const [contract] = await this.db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.contractNumber, contractNumber))
        .limit(1);
      return contract || null;
    }

    if (!studentId) {
      throw new ContractException(
        "INVALID_QUERY",
        "At least one query condition is required: contractId, contractNumber, or studentId",
      );
    }

    const conditions = [eq(schema.contracts.studentId, studentId)];
    if (status) {
      conditions.push(eq(schema.contracts.status, status as ContractStatus));
    }
    if (productId) {
      conditions.push(eq(schema.contracts.productId, productId));
    }

    const contracts = await this.db
      .select()
      .from(schema.contracts)
      .where(and(...conditions))
      .limit(2);

    if (contracts.length === 0) {
      return null;
    }

    if (contracts.length > 1) {
      throw new ContractException("CONTRACT_MULTIPLE_FOUND");
    }

    return contracts[0];
  }

  /**
   * Consume service (消费服务)
   * - Deduct service entitlement balance (按优先级扣除服务权益余额)
   * - Create service ledger record (创建服务台账记录)
   * - Release associated hold if provided (如果提供则释放相关的预留)
   *
   * @param dto Service consumption DTO (服务消费DTO)
   * @param createdBy ID of creator (from user context) (创建人ID（来自用户上下文）)
   */
  async consumeService(
    dto: ConsumeServiceDto,
    createdBy: string,
  ): Promise<void> {
    const {
      studentId,
      serviceType,
      quantity,
      relatedBookingId,
      relatedHoldId,
      bookingSource,
    } = dto;

    if (relatedBookingId && !bookingSource) {
      throw new ContractException(
        "BOOKING_SOURCE_REQUIRED",
        "bookingSource is required when relatedBookingId is provided",
      );
    }

    await this.db.transaction(async (tx) => {
      const [student] = await tx
        .select({ id: schema.studentTable.id })
        .from(schema.studentTable)
        .where(eq(schema.studentTable.id, studentId))
        .limit(1);

      if (!student) {
        throw new ContractException("STUDENT_NOT_FOUND");
      }

      const entitlements = await tx
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.studentId, studentId),
            eq(
              schema.contractServiceEntitlements.serviceType,
              serviceType as string,
            ),
          ),
        )
        .for("update");

      if (entitlements.length === 0) {
        throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
      }

      const totalAvailable = entitlements.reduce(
        (sum, ent) => sum + ent.availableQuantity,
        0,
      );

      if (totalAvailable < quantity) {
        throw new ContractException("INSUFFICIENT_BALANCE");
      }

      let remainingQuantity = quantity;
      let currentTotalBalance = totalAvailable;
      const ledgerRecords: Array<{
        studentId: string;
        serviceType: string;
        quantity: number;
        type: "consumption";
        source: "booking_completed";
        balanceAfter: number;
        relatedHoldId: string | null;
        relatedBookingId: string | null;
        metadata?: { bookingSource?: string };
        createdBy: string;
      }> = [];

      for (const entitlement of entitlements) {
        if (remainingQuantity <= 0) break;
        if (entitlement.availableQuantity <= 0) continue;

        const deductAmount = Math.min(
          remainingQuantity,
          entitlement.availableQuantity,
        );

        currentTotalBalance -= deductAmount;

        ledgerRecords.push({
          studentId: studentId,
          serviceType: serviceType,
          quantity: -deductAmount,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: currentTotalBalance,
          relatedHoldId: relatedHoldId,
          relatedBookingId: relatedBookingId,
          metadata:
            relatedBookingId && bookingSource ? { bookingSource } : undefined,
          createdBy,
        });

        remainingQuantity -= deductAmount;
      }

      if (ledgerRecords.length > 0) {
        await tx.insert(schema.serviceLedgers).values(ledgerRecords);
      }

      if (relatedHoldId) {
        await tx
          .update(schema.serviceHolds)
          .set({
            status: HoldStatus.RELEASED,
            releaseReason: "completed",
            releasedAt: new Date(),
          })
          .where(eq(schema.serviceHolds.id, relatedHoldId));
      }
    });
  }

  /**
   * Update contract status (更新合同状态)
   *
   * @param id Contract ID (合同ID)
   * @param targetStatus Target status (目标状态)
   * @param options Optional parameters (reason, signedBy) (可选参数（原因、签署人）)
   * @returns Updated contract (更新后的合同)
   */
  async updateStatus(
    id: string,
    targetStatus: ContractStatus,
    options?: {
      reason?: string;
      signedBy?: string;
    },
  ): Promise<Contract> {
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    const previousStatus = contract.status;
    const changedBy = options?.signedBy || null;

    return await this.db.transaction(async (tx) => {
      switch (targetStatus) {
        case ContractStatus.DRAFT: {
          if (previousStatus !== ContractStatus.SIGNED) {
            throw new ContractException(
              "CONTRACT_NOT_SIGNED",
              "Only signed contracts can be reverted to draft",
            );
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.DRAFT,
            changedBy,
          );
        }

        case ContractStatus.SIGNED: {
          if (previousStatus !== ContractStatus.DRAFT) {
            throw new ContractException("CONTRACT_NOT_DRAFT");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.SIGNED,
            changedBy,
          );
        }

        case ContractStatus.ACTIVE: {
          if (previousStatus === ContractStatus.ACTIVE) {
            throw new ContractException("CONTRACT_ALREADY_ACTIVE");
          }
          if (previousStatus === ContractStatus.SUSPENDED) {
            return this.applyStatusChange(
              tx,
              id,
              previousStatus,
              ContractStatus.ACTIVE,
              changedBy,
            );
          }
          if (previousStatus === ContractStatus.SIGNED) {
            return this.applyStatusChange(
              tx,
              id,
              previousStatus,
              ContractStatus.ACTIVE,
              changedBy,
            );
          }
          throw new ContractException(
            "INVALID_CONTRACT_STATUS",
            `Cannot activate contract from status: ${previousStatus}`,
          );
        }

        case ContractStatus.SUSPENDED: {
          if (previousStatus !== ContractStatus.ACTIVE) {
            throw new ContractException("CONTRACT_NOT_ACTIVE");
          }
          if (!options?.reason || options.reason.trim().length === 0) {
            throw new ContractException("SUSPENSION_REQUIRES_REASON");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.SUSPENDED,
            changedBy,
            options.reason,
          );
        }

        case ContractStatus.COMPLETED: {
          if (previousStatus !== ContractStatus.ACTIVE) {
            throw new ContractException("CONTRACT_NOT_ACTIVE");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.COMPLETED,
            changedBy,
          );
        }

        case ContractStatus.TERMINATED: {
          if (
            previousStatus !== ContractStatus.ACTIVE &&
            previousStatus !== ContractStatus.SUSPENDED
          ) {
            throw new ContractException("CONTRACT_NOT_TERMINATABLE");
          }
          if (!options?.reason || options.reason.trim().length === 0) {
            throw new ContractException("TERMINATION_REQUIRES_REASON");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.TERMINATED,
            changedBy,
            options.reason,
          );
        }

        default:
          throw new ContractException(
            "INVALID_STATUS",
            `Invalid target status: ${targetStatus}`,
          );
      }
    });
  }

  /**
   * Update contract (更新合同)
   * Only supports updating core fields for draft contracts (仅支持草稿合同的核心字段更新)
   *
   * @param id Contract ID (合同ID)
   * @param dto Update data (更新数据)
   * @returns Updated contract (更新后的合同)
   */
  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    if (!dto) {
      throw new ContractException("INVALID_DTO", "Update data is required");
    }

    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    if (contract.status !== ContractStatus.DRAFT) {
      throw new ContractException(
        "CONTRACT_NOT_DRAFT",
        `Only draft contracts can be updated. Current status: ${contract.status}`,
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.totalAmount !== undefined) updateData.totalAmount = dto.totalAmount;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.validityDays !== undefined)
      updateData.validityDays = dto.validityDays;

    if (dto.currency !== undefined && dto.totalAmount === undefined) {
      updateData.totalAmount = parseFloat(contract.totalAmount.toString());
    }

    if (Object.keys(updateData).length === 1) {
      throw new ContractException(
        "NO_FIELDS_TO_UPDATE",
        "No fields provided for update",
      );
    }

    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set(updateData)
        .where(eq(schema.contracts.id, id))
        .returning();

      return updatedContract;
    });
  }

  /**
   * Get service balance (获取服务余额)
   *
   * @param query Query parameters (查询参数)
   * @returns Service balance information (服务余额信息)
   */
  async getServiceBalance(query: {
    studentId: string;
    serviceType?: string;
  }): Promise<
    Array<{
      studentId: string;
      serviceType: string;
      totalQuantity: number;
      consumedQuantity: number;
      heldQuantity: number;
      availableQuantity: number;
    }>
  > {
    const { studentId, serviceType } = query;

    if (!studentId) {
      throw new ContractException("INVALID_QUERY", "Student ID is required");
    }

    const conditions: SQL<unknown>[] = [
      eq(schema.contractServiceEntitlements.studentId, studentId),
    ];

    if (serviceType) {
      conditions.push(
        eq(
          schema.contractServiceEntitlements.serviceType,
          serviceType as string,
        ),
      );
    }

    const entitlementsResult = await this.db
      .select({
        studentId: schema.contractServiceEntitlements.studentId,
        serviceType: schema.contractServiceEntitlements.serviceType,
        totalQuantity: schema.contractServiceEntitlements.totalQuantity,
        consumedQuantity: schema.contractServiceEntitlements.consumedQuantity,
        heldQuantity: schema.contractServiceEntitlements.heldQuantity,
        availableQuantity: schema.contractServiceEntitlements.availableQuantity,
      })
      .from(schema.contractServiceEntitlements)
      .where(and(...conditions));

    const entitlements = Array.isArray(entitlementsResult)
      ? entitlementsResult
      : [];

    return entitlements.map((entitlement) => ({
      studentId: entitlement.studentId,
      serviceType: entitlement.serviceType,
      totalQuantity: entitlement.totalQuantity,
      consumedQuantity: entitlement.consumedQuantity,
      heldQuantity: entitlement.heldQuantity,
      availableQuantity: entitlement.availableQuantity,
    }));
  }

  /**
   * Add additional entitlement (添加额外权益)
   * Creates amendment ledger record and updates entitlement (创建权益变更台账记录并更新权益)
   *
   * @param dto Amendment ledger data (权益变更台账数据)
   * @returns Updated entitlement (更新后的权益)
   */
  async addAmendmentLedger(
    dto: AddAmendmentLedgerDto,
  ): Promise<ContractServiceEntitlement> {
    const {
      studentId,
      contractId,
      serviceType,
      ledgerType,
      quantityChanged,
      reason,
      description,
      attachments,
      relatedBookingId,
      bookingSource,
      createdBy,
    } = dto;

    if (relatedBookingId && !bookingSource) {
      throw new ContractException(
        "BOOKING_SOURCE_REQUIRED",
        "bookingSource is required when relatedBookingId is provided",
      );
    }

    const contract = await this.findOne({ contractId });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    return await this.db.transaction(async (tx) => {
      const serviceTypeCode =
        typeof serviceType === "string" ? serviceType : serviceType.code;
      await tx
        .insert(schema.contractAmendmentLedgers)
        .values({
          studentId,
          serviceType: serviceTypeCode,
          ledgerType,
          quantityChanged,
          reason,
          description:
            description ||
            `Add ${serviceTypeCode} entitlement for contract ${contractId}`,
          attachments,
          createdBy,
          snapshot: {
            contractId,
            contractNumber: contract.contractNumber,
          },
        })
        .returning();

      await tx.insert(schema.serviceLedgers).values({
        studentId,
        serviceType: serviceTypeCode,
        type: "adjustment",
        source: "manual_adjustment",
        quantity: quantityChanged,
        balanceAfter: 0,
        reason: `Added ${serviceTypeCode} entitlement: ${reason || "No reason provided"}`,
        relatedBookingId: relatedBookingId || null,
        metadata:
          relatedBookingId && bookingSource ? { bookingSource } : undefined,
        createdBy,
      });

      const entitlement = await tx.query.contractServiceEntitlements.findFirst({
        where: and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceTypeCode),
        ),
      });

      if (!entitlement) {
        throw new ContractException(
          "ENTITLEMENT_UPDATE_FAILED",
          "Failed to update entitlement after amendment ledger insertion. Trigger may have failed.",
        );
      }

      return entitlement;
    });
  }

  /**
   * Search contracts (搜索合同)
   * - Supports filtering by studentId, status, productId (支持按学生ID、状态、产品ID筛选)
   * - Supports pagination and sorting (支持分页和排序)
   * - Returns paginated result (返回分页结果)
   */
  async search(
    filter: {
      studentId?: string;
      status?: string;
      productId?: string;
      signedAfter?: Date;
      signedBefore?: Date;
    },
    pagination?: { page: number; pageSize: number },
    sort?: { field: string; order: "asc" | "desc" },
  ): Promise<{
    data: Contract[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { studentId, status, productId } = filter;
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const sortField = sort?.field || "createdAt";
    const sortOrder = sort?.order || "desc";

    const conditions: SQL<unknown>[] = [];

    if (studentId) {
      conditions.push(eq(schema.contracts.studentId, studentId));
    }
    if (status) {
      conditions.push(eq(schema.contracts.status, status as ContractStatus));
    }
    if (productId) {
      conditions.push(eq(schema.contracts.productId, productId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(schema.contracts)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const allowedSortFields = ["createdAt", "contractNumber"];
    if (sortField && !allowedSortFields.includes(sortField)) {
      throw new ContractException(
        "INVALID_SORT_FIELD",
        `Sort field '${sortField}' is not supported. Allowed fields: ${allowedSortFields.join(", ")}`,
      );
    }

    const baseQuery = this.db
      .select()
      .from(schema.contracts)
      .where(whereClause);

    let query;
    if (sortField === "createdAt") {
      query = baseQuery.orderBy(
        sortOrder === "asc"
          ? asc(schema.contracts.createdAt)
          : desc(schema.contracts.createdAt),
      );
    } else if (sortField === "contractNumber") {
      query = baseQuery.orderBy(
        sortOrder === "asc"
          ? asc(schema.contracts.contractNumber)
          : desc(schema.contracts.contractNumber),
      );
    } else {
      query = baseQuery.orderBy(desc(schema.contracts.createdAt));
    }

    const finalQuery = query.limit(pageSize).offset((page - 1) * pageSize);

    const data = await finalQuery;

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
