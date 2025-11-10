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
import { FindOneContractDto } from "../dto/find-one-contract.dto";
import { ConsumeServiceDto } from "../dto/consume-service.dto";
import { AddEntitlementDto } from "../dto/add-entitlement.dto";
import type { ContractEntitlementRevision } from "@infrastructure/database/schema";
import { calculateExpirationDate } from "../common/utils/date.utils";
import {
  validatePrice,
  validatePriceOverride,
} from "../common/utils/validation.utils";
import { sortByConsumptionPriority } from "../common/constants/contract.constants";
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
    const {
      productSnapshot,
      studentId,
      overrideAmount,
      overrideReason,
      overrideApprovedBy,
      createdBy,
      title,
    } = dto;

    // 1. Validate price(1. 验证价格)
    const originalPrice = parseFloat(productSnapshot.price);
    validatePrice(originalPrice * 100); // Convert to cents(转换为分)

    // 2. Validate price override if provided(2. 如果提供价格覆盖则验证价格覆盖)
    if (overrideAmount) {
      const overridePriceValue = parseFloat(overrideAmount);
      validatePriceOverride(originalPrice * 100, overridePriceValue * 100);

      if (!overrideReason || !overrideApprovedBy) {
        throw new ContractException("PRICE_OVERRIDE_REQUIRES_REASON");
      }
    }

    // 3. Calculate validity period(3. 计算有效期)
    const signedAt = dto.signedAt ? new Date(dto.signedAt) : new Date();
    const expiresAt = calculateExpirationDate(
      signedAt,
      productSnapshot.validityDays || null,
    );

    // 4. Generate contract number using database function(4. 使用数据库函数生成合约编号)
    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (
      contractNumberResult.rows[0] as IGenerateContractNumberResult
    ).contract_number;

    // 5. Create contract in transaction(5. 在事务中创建合约)
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
          status: "draft",
          totalAmount: productSnapshot.price,
          currency: productSnapshot.currency as CurrencyEnum,
          validityDays: productSnapshot.validityDays,
          signedAt,
          expiresAt,
          overrideAmount,
          overrideReason,
          overrideApprovedBy,
          createdBy,
        })
        .returning();

      // 6. Publish domain event (entitlements will be created on activation)(6. 发布领域事件(激活时创建权利))
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
          contractId: updatedContract.id,
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
    const { contractId, serviceType, quantity, relatedBookingId, relatedHoldId, createdBy } =
      dto;

    await this.db.transaction(async (tx) => {
      // 1. Find contract(1. 查找合约)
      const [contract] = await tx
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);

      if (!contract) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      if (contract.status !== "active") {
        throw new ContractException("CONTRACT_NOT_ACTIVE");
      }

      // 2. Find entitlements for this service type, sorted by priority(2. 查找此服务类型的权利，按优先级排序)
      const entitlements = await tx
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.contractId, contractId),
            eq(
              schema.contractServiceEntitlements.serviceType,
              serviceType as ServiceType,
            ),
          ),
        )
        .for("update"); // Pessimistic lock(悲观锁)

      if (entitlements.length === 0) {
        throw new ContractNotFoundException("ENTITLEMENT_NOT_FOUND");
      }

      // Sort by consumption priority(按消费优先级排序)
      const sortedEntitlements = sortByConsumptionPriority(entitlements);

      // 3. Deduct quantity by priority(3. 按优先级扣除数量)
      let remainingQuantity = quantity;
      for (const entitlement of sortedEntitlements) {
        if (remainingQuantity <= 0) break;
        if (entitlement.availableQuantity <= 0) continue;

        const deductAmount = Math.min(
          remainingQuantity,
          entitlement.availableQuantity,
        );

        // Update entitlement (consumed_quantity will be synced by trigger)(更新权利(consumed_quantity将由触发器同步))
        // Just record the ledger, trigger handles balance update(只需记录台账，触发器处理余额更新)
        await tx.insert(schema.serviceLedgers).values({
          contractId,
          studentId: contract.studentId,
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

      // 4. Check if sufficient balance(4. 检查余额是否充足)
      if (remainingQuantity > 0) {
        throw new ContractException("INSUFFICIENT_BALANCE");
      }

      // 5. Release hold if provided(5. 如果提供则释放预留)
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
        aggregateId: contractId,
        aggregateType: "Contract",
        payload: {
          contractId,
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
  async sign(
    id: string,
    signedBy: string,
  ): Promise<Contract> {
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
   * - Only allowed for draft status contracts(- 仅允许草稿状态的合同)
   * - Can update price override with validation(- 可以更新价格覆盖并进行验证)
   * - Publishes contract.updated event(- 发布合同更新事件)
   */
  async update(
    id: string,
    dto: {
      overrideAmount?: string;
      overrideReason?: string;
      overrideApprovedBy?: string;
      updatedBy?: string;
    },
  ): Promise<Contract> {
    // 1. Find contract(1. 查找合同)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Validate status(2. 验证状态)
    if (contract.status !== "draft") {
      throw new ContractException("CONTRACT_NOT_DRAFT");
    }

    // 3. Validate price override if provided(3. 如果提供价格覆盖则验证)
    const { overrideAmount, overrideReason, overrideApprovedBy, updatedBy } = dto;
    const updateData: {
      updatedAt: Date;
      overrideAmount?: string | null;
      overrideReason?: string | null;
      overrideApprovedBy?: string | null;
    } = {
      updatedAt: new Date(),
    };

    if (overrideAmount !== undefined) {
      if (!overrideAmount) {
        // If overrideAmount is empty string, clear the override(如果overrideAmount为空字符串，清除覆盖)
        updateData.overrideAmount = null;
        updateData.overrideReason = null;
        updateData.overrideApprovedBy = null;
      } else {
        // Validate override(验证覆盖)
        const originalPrice = parseFloat(contract.totalAmount);
        const overridePriceValue = parseFloat(overrideAmount);
        validatePriceOverride(originalPrice * 100, overridePriceValue * 100);

        if (!overrideReason || !overrideApprovedBy) {
          throw new ContractException("PRICE_OVERRIDE_REQUIRES_REASON");
        }

        updateData.overrideAmount = overrideAmount;
        updateData.overrideReason = overrideReason;
        updateData.overrideApprovedBy = overrideApprovedBy;
      }
    }

    // 4. Update contract(4. 更新合同)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set(updateData)
        .where(eq(schema.contracts.id, id))
        .returning();

      // 5. Publish event(5. 发布事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "contract.updated",
        aggregateId: updatedContract.id,
        aggregateType: "Contract",
        payload: {
          contractId: updatedContract.id,
          contractNumber: updatedContract.contractNumber,
          overrideAmount: updatedContract.overrideAmount,
          overrideReason: updatedContract.overrideReason,
          updatedBy: updatedBy || "system",
          updatedAt: new Date(),
        },
        status: "pending",
      });

      return updatedContract;
    });
  }

  /**
   * Get service balance(获取服务余额)
   * - Query service entitlements by contractId or studentId(- 根据合同ID或学生ID查询服务权利)
   * - Aggregates by contract and service type(- 按合同和服务类型汇总)
   * - Returns detailed balance information with expiration status(- 返回详细的余额信息和过期状态)
   */
  async getServiceBalance(query: {
    contractId?: string;
    studentId?: string;
    serviceType?: string;
    includeExpired?: boolean;
  }): Promise<{
    query: {
      contractId?: string;
      studentId?: string;
      serviceType?: string;
    };
    student?: { id: string; name?: string; email?: string };
    contracts: Array<{
      contractId: string;
      contractNumber: string;
      contractTitle?: string;
      contractStatus: string;
      studentId: string;
      signedAt?: Date;
      expiresAt?: Date;
      isExpired: boolean;
      entitlements: Array<{
        serviceType: string;
        serviceName: string;
        totalQuantity: number;
        consumedQuantity: number;
        heldQuantity: number;
        availableQuantity: number;
        expiresAt?: Date;
        isExpired: boolean;
      }>;
    }>;
  }> {
    const { contractId, studentId, serviceType, includeExpired = false } = query;

    // Validate: at least one of contractId or studentId must be provided
    if (!contractId && !studentId) {
      throw new ContractException("INVALID_QUERY", "contractId or studentId is required");
    }

    // Query contracts
    const contractConditions: SQL<unknown>[] = [];
    if (contractId) {
      contractConditions.push(eq(schema.contracts.id, contractId));
    }
    if (studentId) {
      contractConditions.push(eq(schema.contracts.studentId, studentId));
    }

    const contracts = await this.db
      .select({
        id: schema.contracts.id,
        contractNumber: schema.contracts.contractNumber,
        title: schema.contracts.title,
        status: schema.contracts.status,
        studentId: schema.contracts.studentId,
        signedAt: schema.contracts.signedAt,
        expiresAt: schema.contracts.expiresAt,
      })
      .from(schema.contracts)
      .where(and(...contractConditions));

    if (contracts.length === 0) {
      return {
        query: { contractId, studentId, serviceType },
        contracts: [],
      };
    }

    // Get all contract IDs
    const contractIds = contracts.map((c) => c.id);

    // Query entitlements
    const entitlementConditions: SQL<unknown>[] = [
      sql`${schema.contractServiceEntitlements.contractId} IN ${contractIds}`,
    ];
    if (serviceType) {
      entitlementConditions.push(eq(schema.contractServiceEntitlements.serviceType, serviceType as ServiceType));
    }
    if (!includeExpired) {
      // Filter out expired entitlements
      entitlementConditions.push(
        sql`${schema.contractServiceEntitlements.expiresAt} IS NULL OR ${schema.contractServiceEntitlements.expiresAt} > NOW()`,
      );
    }

    const entitlements = await this.db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(and(...entitlementConditions));

    // Group entitlements by contractId and serviceType
    const groupedByContract = new Map<
      string,
      Map<
        string,
        {
          serviceType: string;
          serviceSnapshots: Array<{
            serviceId: string;
            serviceName: string;
            serviceCode: string;
            serviceType: string;
            billingMode: string;
            requiresEvaluation: boolean;
            requiresMentorAssignment: boolean;
            metadata?: {
              features?: string[];
              deliverables?: string[];
              duration?: number;
            };
            snapshotAt: Date;
          }>;
          serviceNames: Set<string>;
          totalQuantity: number;
          consumedQuantity: number;
          heldQuantity: number;
          availableQuantity: number;
          expiresAt?: Date;
        }
      >
    >();

    for (const entitlement of entitlements) {
      const contractId = entitlement.contractId;
      const serviceType = entitlement.serviceType;

      if (!groupedByContract.has(contractId)) {
        groupedByContract.set(contractId, new Map());
      }

      const contractGroup = groupedByContract.get(contractId)!;

      if (!contractGroup.has(serviceType)) {
        contractGroup.set(serviceType, {
          serviceType,
          serviceSnapshots: [],
          serviceNames: new Set<string>(),
          totalQuantity: 0,
          consumedQuantity: 0,
          heldQuantity: 0,
          availableQuantity: 0,
          expiresAt: entitlement.expiresAt || undefined,
        });
      }

      const serviceGroup = contractGroup.get(serviceType)!;

      // Aggregate quantities
      serviceGroup.totalQuantity += entitlement.totalQuantity;
      serviceGroup.consumedQuantity += entitlement.consumedQuantity;
      serviceGroup.heldQuantity += entitlement.heldQuantity;
      serviceGroup.availableQuantity += entitlement.availableQuantity;

      // Collect service snapshot info for names
      if (entitlement.serviceSnapshot) {
        serviceGroup.serviceSnapshots.push(entitlement.serviceSnapshot);
        if (entitlement.serviceSnapshot.serviceName) {
          serviceGroup.serviceNames.add(entitlement.serviceSnapshot.serviceName);
        }
      }
    }

    // Build result structure
    const now = new Date();
    const resultContracts = contracts.map((contract) => {
      const contractGroup = groupedByContract.get(contract.id) || new Map();
      const isContractExpired = contract.expiresAt ? contract.expiresAt < now : false;

      const contractEntitlements = Array.from(contractGroup.values()).map((serviceGroup) => {
        const isExpired = serviceGroup.expiresAt ? serviceGroup.expiresAt < now : isContractExpired;

        // Use first available name, or serviceType as fallback(使用第一个可用的名称，或使用serviceType作为回退)
        const serviceName = serviceGroup.serviceNames.size > 0
          ? Array.from(serviceGroup.serviceNames)[0]
          : serviceGroup.serviceType;

        return {
          serviceType: serviceGroup.serviceType,
          serviceName,
          totalQuantity: serviceGroup.totalQuantity,
          consumedQuantity: serviceGroup.consumedQuantity,
          heldQuantity: serviceGroup.heldQuantity,
          availableQuantity: serviceGroup.availableQuantity,
          expiresAt: serviceGroup.expiresAt,
          isExpired,
        };
      });

      return {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractTitle: contract.title || undefined,
        contractStatus: contract.status,
        studentId: contract.studentId,
        signedAt: contract.signedAt || undefined,
        expiresAt: contract.expiresAt || undefined,
        isExpired: isContractExpired,
        entitlements: contractEntitlements,
      };
    });

    return {
      query: { contractId, studentId, serviceType },
      student: studentId
        ? {
            id: studentId,
            // Note: We would need to query user info if name/email is required
            // For now, just return the ID
          }
        : undefined,
      contracts: resultContracts,
    };
  }

  /**
   * Add additional entitlement(添加额外权益)
   * - All additional entitlements require approval (Decision R6)(- 所有额外权利都需要审批(决策R6))
   * - Creates entitlement record with status='pending' and availableQuantity=0(- 创建状态为'pending'且availableQuantity=0的权利记录)
   * - Creates revision record with status='pending' and requiresApproval=true(- 创建状态为'pending'且requiresApproval=true的修订记录)
   * - Administrator must call approveRevision() to activate(- 管理员必须调用approveRevision()来激活)
   */
  async addEntitlement(
    dto: AddEntitlementDto,
  ): Promise<ContractServiceEntitlement> {
    const { contractId, serviceType, quantity, source, addOnReason, createdBy } =
      dto;

    // 1. Validate contract exists and is active(1. 验证合约存在且处于激活状态)
    const contract = await this.findOne({ contractId });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    if (contract.status !== "active") {
      throw new ContractException("CONTRACT_NOT_ACTIVE");
    }

    // 2. Get next revision number(2. 获取下一个修订号)
    const lastRevisionResult = await this.db
      .select({ maxRevision: sql`MAX(revision_number)` })
      .from(schema.contractEntitlementRevisions)
      .where(eq(schema.contractEntitlementRevisions.contractId, contractId));

    const lastRevision =
      (lastRevisionResult[0]?.maxRevision as number) || 0;
    const nextRevisionNumber = lastRevision + 1;

    // 3. Create entitlement and revision in transaction(3. 在事务中创建权利和修订)
    return await this.db.transaction(async (tx) => {
      // Create minimal service snapshot for addon entitlements(为附加权益创建最小化服务快照)
      const serviceSnapshot = {
        serviceId: `addon-${serviceType}-${Date.now()}`,
        serviceName: serviceType,
        serviceCode: `ADDON_${serviceType.toUpperCase()}`,
        serviceType: serviceType,
        billingMode: "times",
        requiresEvaluation: false,
        requiresMentorAssignment: false,
        snapshotAt: new Date(),
      };

      // Create origin items record (traceability for addon)(创建来源项目记录(附加权益的可追溯性))
      const originItems = [
        {
          productItemType: "addon" as const,
          quantity,
        },
      ];

      // Create entitlement record (pending, not available yet)(创建权利记录(待处理，尚不可用))
      const [entitlement] = await tx
        .insert(schema.contractServiceEntitlements)
        .values({
          contractId,
          serviceType: serviceType as ServiceType,
          source,
          totalQuantity: quantity,
          consumedQuantity: 0,
          heldQuantity: 0,
          availableQuantity: 0, // Not available until approved(在批准前不可用)
          serviceSnapshot: serviceSnapshot as never,
          originItems: originItems as never,
          expiresAt: contract.expiresAt, // Inherit contract expiration(继承合约到期时间)
        })
        .returning();

      if (!entitlement) {
        throw new ContractException("ENTITLEMENT_CREATION_FAILED");
      }

      // Create revision record (pending approval)(创建修订记录(待批准))
      // Note: Using serviceType as serviceName for addon entitlements since we don't have
      // service snapshot from product catalog in this context(注意: 对于附加权益，由于没有产品目录中的服务快照，因此使用serviceType作为serviceName)
      await tx.insert(schema.contractEntitlementRevisions).values({
        contractId,
        entitlementId: entitlement.id,
        serviceType: serviceType as ServiceType,
        serviceName: serviceType,
        revisionNumber: nextRevisionNumber,
        revisionType: source as
          | "addon"
          | "promotion"
          | "compensation",
        source,
        quantityChanged: quantity,
        totalQuantity: quantity,
        availableQuantity: 0,
        status: "pending",
        requiresApproval: true, // Decision R6: All additional entitlements require approval(决策R6: 所有额外权利都需要审批)
        addOnReason,
        createdBy,
      });

      // Publish entitlement.added event(发布权益添加事件)
      await tx.insert(schema.domainEvents).values({
        eventType: "entitlement.added",
        aggregateId: contractId,
        aggregateType: "Contract",
        payload: {
          contractId,
          entitlementId: entitlement.id,
          serviceType,
          quantity,
          source,
          addOnReason,
          requiresApproval: true,
          status: "pending",
        },
        status: "pending",
      });

      return entitlement;
    });
  }

  /**
   * Get entitlement revisions(获取权益修订)
   * - Query revision history for a contract(- 查询合约的修订历史)
   * - Optional filters: serviceType, revisionType, status(- 可选过滤器: 服务类型、修订类型、状态)
   * - Sorted by revisionNumber desc (newest first)(- 按revisionNumber降序排列(最新的在前))
   */
  async getEntitlementRevisions(
    contractId: string,
    options?: {
      serviceType?: ServiceType;
      revisionType?: "initial" | "addon" | "promotion" | "compensation" | "increase" | "decrease" | "expiration" | "termination";
      status?: "pending" | "approved" | "rejected" | "applied";
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    data: ContractEntitlementRevision[];
    total: number;
  }> {
    // Build where conditions(构建where条件)
    const conditions = [
      eq(schema.contractEntitlementRevisions.contractId, contractId),
    ];

    if (options?.serviceType) {
      conditions.push(
        eq(
          schema.contractEntitlementRevisions.serviceType,
          options.serviceType,
        ),
      );
    }

    if (options?.revisionType) {
      conditions.push(
        eq(
          schema.contractEntitlementRevisions.revisionType,
          options.revisionType,
        ),
      );
    }

    if (options?.status) {
      conditions.push(
        eq(schema.contractEntitlementRevisions.status, options.status),
      );
    }

    // Get total count(获取总数)
    const [countResult] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(schema.contractEntitlementRevisions)
      .where(and(...conditions));

    const total = Number(countResult?.count || 0);

    // Get revisions(获取修订)
    const data = await this.db
      .select()
      .from(schema.contractEntitlementRevisions)
      .where(and(...conditions))
      .orderBy(desc(schema.contractEntitlementRevisions.revisionNumber))
      .offset(((options?.page || 1) - 1) * (options?.pageSize || 20))
      .limit(options?.pageSize || 20);

    return { data, total };
  }

  /**
   * Approve entitlement revision(批准权益修订)
   * - Update revision status from pending to applied(- 将修订状态从待处理更新为已应用)
   * - Update entitlement availableQuantity(- 更新权利可用数量)
   * - Create adjustment ledger entry(- 创建调整台账条目)
   */
  async approveRevision(
    revisionId: string,
    approverId: string,
    notes?: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Get revision(1. 获取修订)
      const [revision] = await tx
        .select()
        .from(schema.contractEntitlementRevisions)
        .where(
          eq(schema.contractEntitlementRevisions.id, revisionId),
        );

      if (!revision) {
        throw new ContractNotFoundException("REVISION_NOT_FOUND");
      }

      if (revision.status !== "pending") {
        throw new ContractException("REVISION_NOT_PENDING");
      }

      if (!revision.requiresApproval) {
        throw new ContractException("REVISION_NOT_REQUIRES_APPROVAL");
      }

      // 2. Get contract to retrieve studentId(2. 获取合约以检索学生ID)
      const [contract] = await tx
        .select({ studentId: schema.contracts.studentId })
        .from(schema.contracts)
        .where(eq(schema.contracts.id, revision.contractId))
        .limit(1);

      if (!contract) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      // 3. Update revision status(3. 更新修订状态)
      await tx
        .update(schema.contractEntitlementRevisions)
        .set({
          status: "applied",
          approvedBy: approverId,
          approvedAt: new Date(),
          approvalNotes: notes,
        })
        .where(eq(schema.contractEntitlementRevisions.id, revisionId));

      // 4. Update entitlement availableQuantity(4. 更新权利可用数量)
      await tx
        .update(schema.contractServiceEntitlements)
        .set({
          availableQuantity: revision.totalQuantity,
          updatedAt: new Date(),
        })
        .where(
          eq(
            schema.contractServiceEntitlements.id,
            revision.entitlementId!,
          ),
        );

      // 5. Create adjustment ledger (increase balance)(5. 创建调整台账(增加余额))
      await tx.insert(schema.serviceLedgers).values({
        contractId: revision.contractId,
        studentId: contract.studentId,
        serviceType: revision.serviceType as ServiceType,
        type: "adjustment",
        source: "manual_adjustment",
        quantity: revision.quantityChanged,
        balanceAfter: revision.totalQuantity,
        reason: `Approved revision #${revision.revisionNumber}: ${notes || "No notes"}`,
        createdBy: approverId,
      });
    });
  }

  /**
   * Reject entitlement revision(拒绝权益修订)
   * - Update revision status from pending to rejected(- 将修订状态从待处理更新为已拒绝)
   * - Do NOT update entitlement (keep unavailable)(- 不更新权利(保持不可用))
   */
  async rejectRevision(
    revisionId: string,
    approverId: string,
    reason: string,
  ): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new ContractException("REJECTION_REASON_REQUIRED");
    }

    await this.db.transaction(async (tx) => {
      // 1. Get revision(1. 获取修订)
      const [revision] = await tx
        .select()
        .from(schema.contractEntitlementRevisions)
        .where(
          eq(schema.contractEntitlementRevisions.id, revisionId),
        );

      if (!revision) {
        throw new ContractNotFoundException("REVISION_NOT_FOUND");
      }

      if (revision.status !== "pending") {
        throw new ContractException("REVISION_NOT_PENDING");
      }

      // 2. Update revision status (do NOT modify entitlement)(2. 更新修订状态(不修改权利))
      await tx
        .update(schema.contractEntitlementRevisions)
        .set({
          status: "rejected",
          approvedBy: approverId,
          approvedAt: new Date(),
          approvalNotes: reason,
        })
        .where(eq(schema.contractEntitlementRevisions.id, revisionId));
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
      conditions.push(eq(schema.contracts.status, status as ContractStatusEnum));
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
