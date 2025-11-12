import { Inject, Injectable } from "@nestjs/common";
import { eq, and, sql, SQL, desc, gte, lte } from "drizzle-orm";
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
import type { ContractAmendmentLedger } from "@infrastructure/database/schema";
import { calculateExpirationDate } from "../common/utils/date.utils";
import { validatePrice } from "../common/utils/validation.utils";
import type { Contract } from "@infrastructure/database/schema";
import type {
  IProductSnapshot,
  IGenerateContractNumberResult,
  IEntitlementAggregation,
} from "../common/types/snapshot.types";
import type {
  ServiceType,
  ContractStatusEnum,
  CurrencyEnum,
} from "../common/types/enum.types";
import type { ContractServiceEntitlement } from "@infrastructure/database/schema";

// Type alias for backward compatibility - ContractEntitlementRevision now maps to contract_amendment_ledgers table
type ContractEntitlementRevision = ContractAmendmentLedger;

@Injectable()
export class ContractService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create contract(创建合约)
   * - Generate unique contract number(生成唯一合约编号)
   * - Create contract record (status = signed)(创建合约记录，状态=已签署)
   * - Derive service entitlements from product snapshot(从产品快照派生服务权益)
   * - Publish contract.signed event(发布合约签署事件)
   */
  async create(dto: CreateContractDto): Promise<Contract> {
    const { productSnapshot, studentId, createdBy, title } = dto;

    // 1. Validate price(1. 验证价格)
    const originalPrice = parseFloat(productSnapshot.price);
    validatePrice(originalPrice * 100); // Convert to cents(转换为分)

    // 2. Calculate validity period(2. 计算有效期)
    const signedAt = dto.signedAt ? new Date(dto.signedAt) : new Date();
    const expiresAt = calculateExpirationDate(
      signedAt,
      productSnapshot.validityDays || null,
    );

    // 3. Generate contract number using database function(3. 使用数据库函数生成合约编号)
    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (
      contractNumberResult.rows[0] as IGenerateContractNumberResult
    ).contract_number;

    // 4. Create contract in transaction(4. 在事务中创建合约)
    return await this.db.transaction(async (tx) => {
      // Insert contract(插入合约)
      const [newContract] = await tx
        .insert(schema.contracts)
        .values({
          contractNumber,
          title: title || productSnapshot.productName,
          studentId,
          productId: dto.productId,
          productSnapshot: productSnapshot as never,
          status: "signed",
          totalAmount: productSnapshot.price,
          currency: productSnapshot.currency as CurrencyEnum,
          validityDays: productSnapshot.validityDays,
          signedAt,
          expiresAt,
          createdBy,
        })
        .returning();

      // 5. Publish domain event (entitlements will be created on activation)(5. 发布领域事件(激活时创建权利))
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.signed",
        aggregateId: newContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: newContract.id,
          contractNumber: newContract.contractNumber,
          studentId: newContract.studentId,
          productId: newContract.productId,
          totalAmount: newContract.totalAmount,
          signedAt: newContract.signedAt,
        },
        status: "pending",
      });

      return newContract;
    });
  }

  /**
   * Find one contract(查找单个合约)
   * Supports multiple query methods with priority:(支持多种查询方式，优先级为：)
   * 1. contractId (highest)(1. 合约ID(最高))
   * 2. contractNumber (second)(2. 合约编号(第二))
   * 3. studentId + status combination (lowest)(3. 学生ID+状态组合(最低))
   */
  async findOne(filter: FindOneContractDto): Promise<Contract | null> {
    const { contractId, contractNumber, studentId, status, productId } = filter;

    // Priority 1: Query by contractId(优先级1: 通过合约ID查询)
    if (contractId) {
      const [contract] = await this.db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);
      return contract || null;
    }

    // Priority 2: Query by contractNumber(优先级2: 通过合约编号查询)
    if (contractNumber) {
      const [contract] = await this.db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.contractNumber, contractNumber))
        .limit(1);
      return contract || null;
    }

    // Priority 3: Query by combination (studentId is required)(优先级3: 通过组合查询(需要学生ID))
    if (!studentId) {
      throw new ContractException("INVALID_QUERY");
    }

    const conditions = [eq(schema.contracts.studentId, studentId)];
    if (status) {
      conditions.push(
        eq(schema.contracts.status, status as ContractStatusEnum),
      );
    }
    if (productId) {
      conditions.push(eq(schema.contracts.productId, productId));
    }

    const contracts = await this.db
      .select()
      .from(schema.contracts)
      .where(and(...conditions))
      .limit(2); // Query 2 to detect non-unique results(查询2以检测非唯一结果)

    if (contracts.length === 0) {
      return null;
    }

    if (contracts.length > 1) {
      throw new ContractException("CONTRACT_MULTIPLE_FOUND");
    }

    return contracts[0];
  }

  /**
   * Activate contract(激活合约)
   * - Triggered by payment.succeeded event(- 由支付成功事件触发)
   * - Update status to active(- 更新状态为已激活)
   * - Set activatedAt timestamp(- 设置激活时间戳)
   * - Create service entitlements from product snapshot(- 从产品快照创建服务权利)
   * - Publish contract.activated event(- 发布合约激活事件)
   */
  async activate(id: string): Promise<Contract> {
    // 1. Find contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "signed") {
      throw new ContractException("CONTRACT_NOT_DRAFT");
    }

    // 3. Update status and create entitlements(3. 更新状态并创建权利)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "active",
          activatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Create service entitlements from product snapshot(4. 从产品快照创建服务权利)
      const productSnapshot =
        contract.productSnapshot as unknown as IProductSnapshot;
      const entitlementMap = new Map<string, IEntitlementAggregation>();

      // Parse product items and aggregate by service type(解析产品项并按服务类型聚合)
      for (const item of productSnapshot.items || []) {
        if (item.productItemType === "service" && item.service) {
          const serviceType = item.service.serviceType;
          const existing = entitlementMap.get(serviceType);

          if (existing) {
            existing.totalQuantity += item.quantity;
            existing.originItems.push({
              productItemType: "service",
              productItemId: item.productItemId,
              quantity: item.quantity,
            });
          } else {
            entitlementMap.set(serviceType, {
              serviceType: serviceType as ServiceType,
              totalQuantity: item.quantity,
              serviceSnapshot: item.service,
              originItems: [
                {
                  productItemType: "service",
                  productItemId: item.productItemId,
                  quantity: item.quantity,
                },
              ],
            });
          }
        } else if (
          item.productItemType === "service_package" &&
          item.servicePackage
        ) {
          // Expand service package items(展开服务包项)
          for (const pkgItem of item.servicePackage.items || []) {
            const serviceType = pkgItem.service.serviceType;
            const quantity = item.quantity * pkgItem.quantity; // Product quantity * package item quantity(产品数量 * 包项数量)
            const existing = entitlementMap.get(serviceType);

            if (existing) {
              existing.totalQuantity += quantity;
              existing.originItems.push({
                productItemType: "service_package",
                productItemId: item.productItemId,
                quantity,
                servicePackageName: item.servicePackage.servicePackageName,
              });
            } else {
              entitlementMap.set(serviceType, {
                serviceType: serviceType as ServiceType,
                totalQuantity: quantity,
                serviceSnapshot: pkgItem.service,
                originItems: [
                  {
                    productItemType: "service_package",
                    productItemId: item.productItemId,
                    quantity,
                    servicePackageName: item.servicePackage.servicePackageName,
                  },
                ],
              });
            }
          }
        }
      }

      // Insert entitlements(插入权利)
      const entitlements = Array.from(entitlementMap.values()).map(
        (entitlement) => ({
          studentId: updatedContract.studentId,
          serviceType: entitlement.serviceType as ServiceType,
          source: "product" as const,
          totalQuantity: entitlement.totalQuantity,
          availableQuantity: entitlement.totalQuantity,
          serviceSnapshot: entitlement.serviceSnapshot as never,
          originItems: entitlement.originItems as never,
          expiresAt: updatedContract.expiresAt,
        }),
      );

      if (entitlements.length > 0) {
        await tx
          .insert(schema.contractServiceEntitlements)
          .values(entitlements);
      }

      // 5. Publish event(5. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.activated",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          activatedAt: updatedContract.activatedAt,
          entitlementsCreated: entitlements.length,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Consume service(消费服务)
   * - Deduct service entitlement balance by priority(- 按优先级扣除服务权利余额)
   * - Priority: product > addon > promotion > compensation(- 优先级: 产品 > 附加服务 > 促销 > 补偿)
   * - Create service ledger record(- 创建服务台账记录)
   * - Release associated hold if provided(- 如果提供则释放相关的预留)
   */
  async consumeService(dto: ConsumeServiceDto): Promise<void> {
    const {
      studentId,
      serviceType,
      quantity,
      relatedBookingId,
      relatedHoldId,
      createdBy,
    } = dto;

    await this.db.transaction(async (tx) => {
      // 1. Check student exists - v2.16.12: Query student instead of specific contract
      const [student] = await tx
        .select({ id: schema.userTable.id })
        .from(schema.userTable)
        .where(eq(schema.userTable.id, studentId))
        .limit(1);

      if (!student) {
        throw new ContractNotFoundException("STUDENT_NOT_FOUND");
      }

      // 2. Find ALL entitlements for this student and service type across all contracts
      // v2.16.12: Changed from contract-level to student-level query
      const entitlements = await tx
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.studentId, studentId),
            eq(
              schema.contractServiceEntitlements.serviceType,
              serviceType as ServiceType,
            ),
          ),
        )
        .for("update"); // Pessimistic lock for concurrency safety

      if (entitlements.length === 0) {
        throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
      }

      // 3. Calculate total available balance
      const totalAvailable = entitlements.reduce(
        (sum, ent) => sum + ent.availableQuantity,
        0,
      );

      if (totalAvailable < quantity) {
        throw new ContractException("INSUFFICIENT_BALANCE");
      }

      // 4. Consume from entitlements (simple FIFO - consume from first entitlement)
      // v2.16.12: For now using simple approach, can enhance with priority later
      let remainingQuantity = quantity;

      for (const entitlement of entitlements) {
        if (remainingQuantity <= 0) break;
        if (entitlement.availableQuantity <= 0) continue;

        const deductAmount = Math.min(
          remainingQuantity,
          entitlement.availableQuantity,
        );

        // v2.16.12: Record consumption (trigger will update consumed_quantity automatically)
        // Note: No contractId in service_ledgers anymore (student-level tracking)
        await tx.insert(schema.serviceLedgers).values({
          studentId: studentId,
          serviceType: serviceType as ServiceType,
          quantity: -deductAmount,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: entitlement.availableQuantity - deductAmount,
          relatedHoldId: relatedHoldId,
          relatedBookingId: relatedBookingId,
          createdBy,
        });

        remainingQuantity -= deductAmount;
      }

      // 5. Release hold if provided
      if (relatedHoldId) {
        await tx
          .update(schema.serviceHolds)
          .set({
            status: "released",
            releaseReason: "completed",
            releasedAt: new Date(),
          })
          .where(eq(schema.serviceHolds.id, relatedHoldId));
      }

      // 6. Publish event(6. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "service.consumed",
        aggregateId: studentId, // Use studentId as aggregateId since we're tracking at student level
        aggregateType: "Student", // Changed from Contract to Student to reflect new entity
        payload: {
          studentId,
          serviceType,
          quantity,
          relatedBookingId,
        },
        status: "pending",
      });
    });
  }

  /**
   * Terminate contract(终止合约)
   * - Update status to terminated(- 更新状态为已终止)
   * - Set terminatedAt timestamp(- 设置终止时间戳)
   * - Publish contract.terminated event(- 发布合约终止事件)
   * - Allowed from: active, suspended(- 允许从: 激活、暂停状态)
   */
  async terminate(
    id: string,
    reason: string,
    terminatedBy: string,
  ): Promise<Contract> {
    // 1. Find contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "active" && contract.status !== "suspended") {
      throw new ContractException("CONTRACT_NOT_TERMINATABLE");
    }

    // 3. Validate reason(3. 验证原因)
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("TERMINATION_REQUIRES_REASON");
    }

    // 4. Update status(4. 更新状态)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "terminated",
          terminatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 5. Publish event(5. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.terminated",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          reason,
          terminatedBy,
          terminatedAt: updatedContract.terminatedAt,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Suspend contract(暂停合约)
   * - Update status to suspended(- 更新状态为暂停)
   * - Set suspendedAt timestamp(- 设置暂停时间戳)
   * - Publish contract.suspended event(- 发布合约暂停事件)
   * - Admin operation only(- 仅限管理员操作)
   * - Allowed from: active(- 允许从: 激活状态)
   */
  async suspend(
    id: string,
    reason: string,
    suspendedBy: string,
  ): Promise<Contract> {
    // 1. Find contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "active") {
      throw new ContractException("CONTRACT_NOT_ACTIVE");
    }

    // 3. Validate reason(3. 验证原因)
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("SUSPENSION_REQUIRES_REASON");
    }

    // 4. Update status(4. 更新状态)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "suspended",
          suspendedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 5. Publish event(5. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.suspended",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          reason,
          suspendedBy,
          suspendedAt: updatedContract.suspendedAt,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Resume contract(恢复合约)
   * - Update status to active(- 更新状态为激活)
   * - Set resumedAt timestamp(- 设置恢复时间戳)
   * - Publish contract.resumed event(- 发布合约恢复事件)
   * - Admin operation only(- 仅限管理员操作)
   * - Allowed from: suspended(- 允许从: 暂停状态)
   */
  async resume(id: string, resumedBy: string): Promise<Contract> {
    // 1. Find contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "suspended") {
      throw new ContractException("CONTRACT_NOT_SUSPENDED");
    }

    // 3. Update status(3. 更新状态)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "active",
          suspendedAt: null, // Clear suspension timestamp(清除暂停时间戳)
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Publish event(4. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.resumed",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          resumedBy,
          resumedAt: new Date(),
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Complete contract(完成合约)
   * - Update status to completed(- 更新状态为已完成)
   * - Set completedAt timestamp(- 设置完成时间戳)
   * - Publish contract.completed event(- 发布合约完成事件)
   * - Triggered by: expiration (auto) or admin action (manual)(- 触发方式: 过期(自动)或管理员操作(手动))
   * - Allowed from: active(- 允许从: 激活状态)
   */
  async complete(id: string, completedBy?: string): Promise<Contract> {
    // 1. Find contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "active") {
      throw new ContractException("CONTRACT_NOT_ACTIVE");
    }

    // 3. Update status(3. 更新状态)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Publish event(4. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.completed",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          completedBy: completedBy || "system",
          completedAt: updatedContract.completedAt,
          isAutoCompleted: !completedBy,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Sign contract(签署合约)
   * - Update status from draft to signed(- 将状态从草稿更新为已签署)
   * - Set signedAt timestamp(- 设置签署时间戳)
   * - Allowed from: draft(- 允许从: 草稿状态)
   */
  async sign(id: string, signedBy: string): Promise<Contract> {
    // 1. Find contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "draft") {
      throw new ContractException("CONTRACT_NOT_DRAFT");
    }

    // 3. Update status(3. 更新状态)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: "signed",
          signedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Publish event(4. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.signed",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          studentId: updatedContract.studentId,
          signedAt: updatedContract.signedAt,
          signedBy,
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Update contract(更新合同)
   - Supports updating core contract fields for draft contracts(支持草稿合同的核心字段更新)
   - Supports updating lifecycle fields for any contract(支持任何合同的生命周期字段更新)
   - Publishes contract.updated event(发布合同更新事件)
   */
  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    // Validate input parameters(验证输入参数)
    if (!dto) {
      throw new ContractException("INVALID_DTO", "Update data is required");
    }

    // 1. Find contract(1. 查找合同)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Separate core fields from lifecycle fields(2. 分离核心字段和生命周期字段)
    const coreFields = {
      title: dto.title,
      totalAmount: dto.totalAmount,
      currency: dto.currency,
      validityDays: dto.validityDays,
    };

    const lifecycleFields = {
      suspendedAt: dto.suspendedAt,
      suspendedReason: dto.suspendedReason,
      resumedAt: dto.resumedAt,
      terminatedAt: dto.terminatedAt,
      terminatedReason: dto.terminatedReason,
      completedAt: dto.completedAt,
    };

    // 3. Validate core field updates(3. 验证核心字段更新)
    const hasCoreFieldUpdates = Object.values(coreFields).some(
      (value) => value !== undefined,
    );
    if (hasCoreFieldUpdates && contract.status !== "draft") {
      throw new ContractException("CONTRACT_NOT_DRAFT_CORE_FIELDS");
    }

    // 4. Validate currency consistency(4. 验证货币一致性)
    if (dto.currency && dto.totalAmount === undefined) {
      // If currency is updated but amount is not, keep the original amount
      coreFields.totalAmount = parseFloat(contract.totalAmount.toString());
    }

    // 5. Prepare update data(5. 准备更新数据)
    const updateData: any = {
      updatedAt: new Date(),
      ...lifecycleFields,
    };

    // Add core fields only if contract is in draft status(仅在草稿状态下添加核心字段)
    if (contract.status === "draft") {
      Object.assign(updateData, coreFields);

      // Recalculate expiration date if validityDays is updated(如果更新了有效期，重新计算到期日期)
      if (dto.validityDays !== undefined) {
        const signedAt = contract.signedAt || new Date();
        updateData.expiresAt = calculateExpirationDate(
          signedAt,
          dto.validityDays,
        );
      }
    }

    // 6. Update contract(6. 更新合同)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set(updateData)
        .where(eq(schema.contracts.id, id))
        .returning();

      // 7. Publish event(7. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.updated",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          updatedBy: dto.updatedBy || "system",
          updateReason: dto.updateReason || "Contract updated",
          updatedAt: new Date(),
          updatedFields: {
            ...coreFields,
            ...lifecycleFields,
          },
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Get service balance(获取服务余额) - v2.16.12: 学生级权益累积制
   * - Query service entitlements by studentId(- 根据学生ID查询服务权利)
   * - Aggregates by student and service type(- 按学生和服务类型汇总)
   * - Returns detailed balance information(- 返回详细的余额信息)
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

    // Validate input parameters(验证输入参数)
    if (!studentId) {
      throw new ContractException("INVALID_QUERY", "Student ID is required");
    }

    // Build query conditions(构建查询条件)
    const conditions: SQL<unknown>[] = [
      eq(schema.contractServiceEntitlements.studentId, studentId),
    ];

    if (serviceType) {
      conditions.push(
        eq(
          schema.contractServiceEntitlements.serviceType,
          serviceType as ServiceType,
        ),
      );
    }

    // Query entitlements directly from contract_service_entitlements table
    // v2.16.12: Direct query at student level, no need to join with contracts table
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

    // Ensure we have an array to work with
    const entitlements = Array.isArray(entitlementsResult)
      ? entitlementsResult
      : [];

    // Return the results in the expected format
    // v2.16.12: Each student has one record per service type (cumulative system)
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
   * Add additional entitlement(添加额外权益)
   * - v2.16.10: 移除审批流程，所有权益变更直接生效
   * - v2.16.12: Primary key changed from contractId to studentId
   * - v2.16.12: Changed to insert into ledger table (trigger updates entitlement)
   * - v2.16.13: Renamed from entitlement to amendment ledger
   * - Creates entitlement record with availableQuantity=quantity(创建权益记录，可用数量等于添加数量)
   * - Creates amendment ledger record(创建权益变更台账记录)
   * - Creates service ledger entry for audit trail(创建服务流水记录用于审计跟踪)
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
      createdBy,
    } = dto;

    // 1. Validate contract exists and is active(1. 验证合约存在且处于激活状态)
    const contract = await this.findOne({ contractId });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    if (contract.status !== "active") {
      throw new ContractException("CONTRACT_NOT_ACTIVE");
    }

    // 2. Get next revision number(2. 获取下一个修订号)
    // const lastRevisionResult = await this.db
    //   .select({ maxRevision: sql`MAX(revision_number)` })
    //   .from(schema.contractAmendmentLedgers)
    //   .where(eq(schema.contractAmendmentLedgers.contractId, contractId));

    // const lastRevision = (lastRevisionResult[0]?.maxRevision as number) || 0;
    // const nextRevisionNumber = lastRevision + 1; // Reserved for future use

    // 3. Create entitlement and revision in transaction(3. 在事务中创建权利和修订)
    return await this.db.transaction(async (tx) => {
      // Create entitlement record (immediately available)(创建权益记录(立即可用))
      // v2.16.12: Use UPSERT to handle existing entitlements (cumulative system)
      const [entitlement] = await tx
        .insert(schema.contractServiceEntitlements)
        .values({
          studentId,
          serviceType: serviceType as ServiceType,
          source: ledgerType,
          totalQuantity: quantityChanged,
          consumedQuantity: 0,
          heldQuantity: 0,
          availableQuantity: quantityChanged, // Immediately available(立即可用)
          expiresAt: contract?.expiresAt, // Inherit contract expiration if available(如果合约可用则继承合约到期时间)
          createdBy,
        })
        .onConflictDoUpdate({
          target: [
            schema.contractServiceEntitlements.studentId,
            schema.contractServiceEntitlements.serviceType,
          ],
          set: {
            totalQuantity: sql`${schema.contractServiceEntitlements.totalQuantity} + ${quantityChanged}`,
            availableQuantity: sql`${schema.contractServiceEntitlements.availableQuantity} + ${quantityChanged}`,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!entitlement) {
        throw new ContractException("ENTITLEMENT_CREATION_FAILED");
      }

      // Create amendment ledger record (audit trail)(创建权益变更台账记录(审计跟踪))
      await tx.insert(schema.contractAmendmentLedgers).values({
        studentId,
        serviceType: serviceType as ServiceType,
        ledgerType,
        quantityChanged,
        reason,
        description:
          description ||
          `Add ${serviceType} entitlement for contract ${contractId}`,
        attachments,
        createdBy,
        snapshot: {
          contractId,
          contractNumber: contract.contractNumber,
        },
      });

      // Create service ledger entry for audit trail(创建服务流水记录用于审计跟踪)
      await tx.insert(schema.serviceLedgers).values({
        studentId,
        serviceType: serviceType as ServiceType,
        type: "adjustment",
        source: "manual_adjustment",
        quantity: quantityChanged,
        balanceAfter: entitlement.availableQuantity,
        reason: `Added ${serviceType} entitlement: ${reason || "No reason provided"}`,
        createdBy,
      });

      // Publish entitlement.added event(发布权益添加事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "entitlement.added",
        aggregateId: contractId,
        aggregateType: "Contract",
        payload: {
          contractId,
          entitlementId: `${studentId}-${serviceType}`, // Composite key representation
          serviceType,
          quantity: quantityChanged,
          source: ledgerType,
          reason,
          status: "active", // v2.16.10: 直接生效
        },
        status: "pending",
      });

      return entitlement;
    });
  }

  /**
   * Search contracts(搜索合同)
   * - Supports filtering by studentId, status, productId, date ranges(支持按学生ID、状态、产品ID、日期范围筛选)
   * - Supports pagination and sorting(支持分页和排序)
   * - Returns paginated result(返回分页结果)
   */
  async search(
    filter: {
      studentId?: string;
      status?: string;
      productId?: string;
      signedAfter?: Date;
      signedBefore?: Date;
      expiresAfter?: Date;
      expiresBefore?: Date;
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
    const {
      studentId,
      status,
      productId,
      signedAfter,
      signedBefore,
      expiresAfter,
      expiresBefore,
    } = filter;
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const sortField = sort?.field || "createdAt";
    const sortOrder = sort?.order || "desc";

    // Build WHERE conditions(构建WHERE条件)
    const conditions: SQL<unknown>[] = [];

    if (studentId) {
      conditions.push(eq(schema.contracts.studentId, studentId));
    }
    if (status) {
      conditions.push(
        eq(schema.contracts.status, status as ContractStatusEnum),
      );
    }
    if (productId) {
      conditions.push(eq(schema.contracts.productId, productId));
    }
    if (signedAfter) {
      conditions.push(gte(schema.contracts.signedAt, signedAfter));
    }
    if (signedBefore) {
      conditions.push(lte(schema.contracts.signedAt, signedBefore));
    }
    if (expiresAfter) {
      conditions.push(gte(schema.contracts.expiresAt, expiresAfter));
    }
    if (expiresBefore) {
      conditions.push(lte(schema.contracts.expiresAt, expiresBefore));
    }

    // Get total count(获取总数)
    const [countResult] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(schema.contracts)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    // Get contracts(获取合同)
    // Use SQL template literal for dynamic ORDER BY(对动态ORDER BY使用SQL模板字面量)
    let orderByClause: SQL | undefined;
    if (sortField === "createdAt") {
      orderByClause =
        sortOrder === "asc"
          ? sql`${schema.contracts.createdAt} ASC`
          : sql`${schema.contracts.createdAt} DESC`;
    } else if (sortField === "signedAt") {
      orderByClause =
        sortOrder === "asc"
          ? sql`${schema.contracts.signedAt} ASC`
          : sql`${schema.contracts.signedAt} DESC`;
    } else if (sortField === "contractNumber") {
      orderByClause =
        sortOrder === "asc"
          ? sql`${schema.contracts.contractNumber} ASC`
          : sql`${schema.contracts.contractNumber} DESC`;
    } else {
      // Default to createdAt desc(默认为createdAt降序)
      orderByClause = sql`${schema.contracts.createdAt} DESC`;
    }

    const query = this.db
      .select()
      .from(schema.contracts)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const data = await query;

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
