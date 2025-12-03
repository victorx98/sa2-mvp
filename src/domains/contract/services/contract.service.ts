import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, SQL, gte, lte, inArray } from "drizzle-orm";
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
import { validatePrice, validateProductSnapshot } from "../common/utils/validation.utils";
import type { Contract } from "@infrastructure/database/schema";
import type {
  IProductSnapshot,
  IGenerateContractNumberResult,
} from "../common/types/snapshot.types";
import type { ContractServiceEntitlement } from "@infrastructure/database/schema";
import { ContractStatus, HoldStatus } from "@shared/types/contract-enums";

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) { }

  /**
   * Create contract(创建合约)
   * - Generate unique contract number(生成唯一合约编号)
   * - Create contract record (status = signed)(创建合约记录，状态=已签署)
   * - Derive service entitlements from product snapshot(从产品快照派生服务权益)
   * - [修复] Server-side authoritative snapshot: load product data from database and reject mismatches [服务器端权威快照：从数据库加载产品数据并拒绝不匹配]
   */
  async create(dto: CreateContractDto): Promise<Contract> {
    const { productSnapshot, studentId, createdBy, title, productId } = dto;

    // 0. [修复] Load authoritatively from database and reject mismatches (从数据库权威加载并拒绝不匹配) [修复] 验证并提供基本快照结构验证
    validateProductSnapshot(productSnapshot);

    // [修复] Load product details authoritatively from database (从数据库权威加载产品详情) [从数据库权威加载产品信息]
    const [productDetails] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);
    
    if (!productDetails) {
      throw new ContractException("PRODUCT_NOT_FOUND", "Product not found");
    }

    // [修复] Verify product is ACTIVE (must be published) [验证产品处于ACTIVE状态（必须已发布）]
    // Security fix: prevent contracts from being created from draft or inactive products [安全修复：防止从未发布或非活跃产品创建合同]
    if (productDetails.status !== "ACTIVE") {
      throw new ContractException(
        "PRODUCT_NOT_ACTIVE",
        `Product must be ACTIVE to create contract. Current status: ${productDetails.status}`,
      );
    }

    // Load product items with service types [加载产品项目及其服务类型]
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
        eq(schema.productItems.serviceTypeId, schema.serviceTypes.id)
      )
      .where(eq(schema.productItems.productId, productId))
      .orderBy(schema.productItems.sortOrder);

    // [修复] Verify product has at least one item (enforced for new contracts) [验证产品至少有一个项目（对新合同强制要求）]
    if (productItems.length === 0) {
      throw new ContractException(
        "PRODUCT_MIN_ITEMS",
        "Product must have at least one item to create contract",
      );
    }

    // [修复] Verify snapshot matches authoritative product data (验证快照与权威产品数据匹配) [验证快照是否与权威产品数据一致]
    // This prevents contract creation with manipulated price, currency, or entitlement data [这可防止使用被操纵的价格、货币或权益数据创建合同]
    if (productSnapshot.productId !== productId) {
      throw new ContractException(
        "SNAPSHOT_MISMATCH",
        "Product snapshot productId does not match",
      );
    }

    if (productSnapshot.price !== productDetails.price.toString()) {
      throw new ContractException(
        "SNAPSHOT_MISMATCH",
        `Product price mismatch. Provided: ${productSnapshot.price}, Actual: ${productDetails.price}`,
      );
    }

    if (productSnapshot.currency !== productDetails.currency) {
      throw new ContractException(
        "SNAPSHOT_MISMATCH",
        `Product currency mismatch. Provided: ${productSnapshot.currency}, Actual: ${productDetails.currency}`,
      );
    }

    // 1. Validate price using authoritative data (使用权威数据验证价格) [使用权威数据验证价格]
    const originalPrice = parseFloat(productDetails.price.toString());
    validatePrice(originalPrice);

    // 2. Products and contracts never expire (产品和合同永不过期) - v2.16.13
      const signedAt = dto.signedAt ? new Date(dto.signedAt) : new Date();

    // 3. Generate contract number using database function(3. 使用数据库函数生成合约编号)
    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (
      contractNumberResult.rows[0] as unknown as IGenerateContractNumberResult
    ).contract_number;

    // 4. Create contract in transaction using authoritative data (使用权威数据创建合同) [使用权威数据创建合同记录]
    return await this.db.transaction(async (tx) => {
      // Insert contract using SERVER-SIDE verified data (使用服务器端验证的数据插入合同) [使用服务器端验证的数据插入合同]
      const [newContract] = await tx
        .insert(schema.contracts)
        .values({
          contractNumber,
          title: title || productDetails.name, // Use server-side product name (使用服务器端产品名称) [使用服务器端产品名称]
          studentId,
          productId: productId,
          productSnapshot: {
            // Use SERVER-SIDE authoritative data (使用服务器端权威数据) [构建权威产品快照]
            productId: productDetails.id,
            productName: productDetails.name,
            productCode: productDetails.code,
            price: productDetails.price.toString(),
            currency: productDetails.currency,
            items: productItems.map(item => ({
              productItemId: item.id,
              serviceTypeCode: item.serviceTypeCode,
              quantity: item.quantity,
              sortOrder: item.sortOrder,
            })),
            snapshotAt: new Date(),
          } as never,
          status: ContractStatus.SIGNED,
          totalAmount: productDetails.price.toString(),
          currency: productDetails.currency as never,
          signedAt,
          createdBy,
        })
        .returning();

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
      conditions.push(eq(schema.contracts.status, status as ContractStatus));
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
   *
   * v2.16.13: Optimized with batch queries and upsert
   * - Pre-fetch: Batch query service types and existing entitlements
   * - In-memory merge: Calculate quantities in memory
   * - Batch write: Upsert all records at once
   */
  async activate(id: string): Promise<Contract> {
    // 1. Find the contract(1. 查找合约)
    const contract = await this.findOne({ contractId: id });
    if (!contract) {
      throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
    }

    // 2. Check if contract is already active(2. 检查合约是否已激活)
    if (contract.status === ContractStatus.ACTIVE) {
      throw new ContractException("CONTRACT_ALREADY_ACTIVE");
    }

    // 3. Check if contract is in signed status(3. 检查合约是否处于已签署状态)
    if (contract.status !== ContractStatus.SIGNED) {
      throw new ContractException("INVALID_CONTRACT_STATUS");
    }

    // 4. Process activation in transaction(4. 在事务中处理激活)
    return await this.db.transaction(async (tx) => {
      // Update contract status and activation timestamp(更新合约状态和激活时间戳)
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set({
          status: ContractStatus.ACTIVE,
          activatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();



      // Create service entitlements from product snapshot(从产品快照创建服务权益)
      const productSnapshot = contract.productSnapshot as IProductSnapshot;

      // Pre-fetch: Prepare data structures for batch operations
      const items = productSnapshot.items || [];

      if (items.length > 0) {
        // Pre-fetch phase: Get all serviceTypeCodes from items
        const serviceTypeCodes = items
          .map((item) => item.serviceTypeCode)
          .filter(Boolean);

        // Batch query: Get service types for all codes at once
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

        // Create set for quick lookup
        const validServiceTypeCodes = new Set(
          serviceTypesResult.map((st) => st.code),
        );

        // Calculate quantities per service type (in-memory merge)
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

        // Prepare batch insert values
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

        // Batch write: Upsert all records at once
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
                availableQuantity:
                  sql`${schema.contractServiceEntitlements.availableQuantity} + EXCLUDED.available_quantity`,
                updatedAt: new Date(),
              },
            });
        }
      } else {
        // If no items in product snapshot, create a default service entitlement
        // using upsert for consistency
        const defaultServiceType = "DEFAULT_SERVICE";

        await tx
          .insert(schema.contractServiceEntitlements)
          .values({
            studentId: contract.studentId,
            serviceType: defaultServiceType,
            totalQuantity: 1,
            availableQuantity: 1,
            createdBy: contract.createdBy,
          })
          .onConflictDoUpdate({
            target: [
              schema.contractServiceEntitlements.studentId,
              schema.contractServiceEntitlements.serviceType,
            ],
            set: {
              totalQuantity: sql`${schema.contractServiceEntitlements.totalQuantity} + 1`,
              availableQuantity: sql`${schema.contractServiceEntitlements.availableQuantity} + 1`,
              updatedAt: new Date(),
            },
          });
      }

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
        throw new ContractException("STUDENT_NOT_FOUND");
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
              serviceType as string,
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
          serviceType: serviceType,
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
            status: HoldStatus.RELEASED,
            releaseReason: "completed",
            releasedAt: new Date(),
          })
          .where(eq(schema.serviceHolds.id, relatedHoldId));
      }

      // ✅ Contract domain no longer publishes events [合同域不再发布事件]
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
          status: ContractStatus.TERMINATED,
          terminatedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // ✅ Contract domain no longer publishes events [合同域不再发布事件]

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
          status: ContractStatus.SUSPENDED,
          suspendedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // ✅ Contract domain no longer publishes events [合同域不再发布事件]

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
  async resume(id: string): Promise<Contract> {
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
          status: ContractStatus.ACTIVE,
          suspendedAt: null, // Clear suspension timestamp(清除暂停时间戳)
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // 4. Publish event(4. 发布事件) - Using EventEmitter2 directly
      // Event is published after transaction completion to ensure data consistency
      // ✅ Contract domain no longer publishes events [合同域不再发布事件]

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
  async complete(id: string): Promise<Contract> {
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
          status: ContractStatus.COMPLETED,
          completedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

      // ✅ Contract domain no longer publishes events [合同域不再发布事件]

      return updatedContract;
    });
  }

  /**
   * Sign contract(签署合约)
   * - Update status from draft to signed(- 将状态从草稿更新为已签署)
   * - Set signedAt timestamp(- 设置签署时间戳)
   * - Allowed from: draft(- 允许从: 草稿状态)
   */
  async sign(id: string, _signedBy: string): Promise<Contract> {
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
          status: ContractStatus.SIGNED,
          signedAt: new Date(),
        })
        .where(eq(schema.contracts.id, id))
        .returning();

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
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      ...lifecycleFields,
    };

    // Add core fields only if contract is in draft status(仅在草稿状态下添加核心字段)
    if (contract.status === "draft") {
      Object.assign(updateData, coreFields);
    }

    // 6. Update contract(6. 更新合同)
    return await this.db.transaction(async (tx) => {
      const [updatedContract] = await tx
        .update(schema.contracts)
        .set(updateData)
        .where(eq(schema.contracts.id, id))
        .returning();

      // ✅ Contract domain no longer publishes events [合同域不再发布事件]

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
          serviceType as string,
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

    // 3. Create ledger records and rely on trigger to update entitlements
    return await this.db.transaction(async (tx) => {
      // [修复] Insert amendment ledger record (trigger will update entitlement)
      const serviceTypeCode = typeof serviceType === "string" ? serviceType : serviceType.code;
      await tx.insert(schema.contractAmendmentLedgers).values({
        studentId,
        serviceType: serviceTypeCode,
        ledgerType,
        quantityChanged,
        reason,
        description: description ||
          `Add ${serviceTypeCode} entitlement for contract ${contractId}`,
        attachments,
        createdBy,
        snapshot: {
          contractId,
          contractNumber: contract.contractNumber,
        },
      }).returning();

      // Create service ledger entry for audit trail
      await tx.insert(schema.serviceLedgers).values({
        studentId,
        serviceType: serviceTypeCode,
        type: "adjustment",
        source: "manual_adjustment",
        quantity: quantityChanged,
        balanceAfter: 0, // Will be calculated by trigger
        reason: `Added ${serviceTypeCode} entitlement: ${reason || "No reason provided"}`,
        createdBy,
      });

      // Query updated entitlement (trigger has updated it)
      const entitlement = await tx.query.contractServiceEntitlements.findFirst({
        where: and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceTypeCode),
        ),
      });

      // ✅ Contract domain no longer publishes events [合同域不再发布事件]

      return entitlement!;
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
      conditions.push(eq(schema.contracts.status, status as ContractStatus));
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

    // [修复] Build WHERE clause conditionally to handle empty conditions [根据条件构建WHERE子句以处理空条件]
    // This prevents Drizzle runtime error when conditions array is empty [这防止条件数组为空时Drizzle运行时错误]
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count(获取总数)
    const [countResult] = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(schema.contracts)
      .where(whereClause);

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
      .where(whereClause)
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
