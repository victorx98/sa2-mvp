import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { and, asc, count, desc, eq, gte, lte, not, or } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import type {
  IMentorPayableService,
  IMentorPayableLedger,
  IPackageBilling,
  IMentorPrice,
} from "@domains/financial/interfaces/mentor-payable.interface";
import {
  CreatePerSessionBillingDto,
  CreatePackageBillingDto,
  AdjustPayableLedgerDto,
  CreateMentorPriceDto,
} from "@domains/financial/dto";

/**
 * Mentor Payable Service(导师应付账款服务)
 *
 * 实现导师应付账款相关的业务逻辑
 */
@Injectable()
export class MentorPayableService implements IMentorPayableService {
  private readonly logger = new Logger(MentorPayableService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 创建按会话计费记录
   * @param dto 按会话计费DTO
   * @returns 创建的应付账款记录
   */
  public async createPerSessionBilling(
    dto: CreatePerSessionBillingDto,
  ): Promise<IMentorPayableLedger> {
    try {
      this.logger.log(
        `Creating per-session billing for session: ${dto.sessionId}`,
      );

      // 输入验证
      if (
        !dto.mentorUserId ||
        !dto.sessionId ||
        !dto.serviceTypeCode ||
        !dto.studentUserId
      ) {
        throw new BadRequestException(
          "Missing required fields for billing creation",
        );
      }

      if (dto.durationHours <= 0) {
        throw new BadRequestException("Duration must be greater than zero");
      }

      // 获取导师价格 - 使用serviceTypeCode查询mentorPrices表
      const mentorPrice = await this.getMentorPrice(
        dto.mentorUserId,
        dto.serviceTypeCode,
      );

      if (!mentorPrice) {
        throw new BadRequestException(
          `No active price found for mentor: ${dto.mentorUserId} and service type: ${dto.serviceTypeCode}`,
        );
      }

      // 计算总金额 - 使用toFixed保持金融计算精度
      const unitPrice = Number(mentorPrice.price);
      const totalAmount = Number((unitPrice * dto.durationHours).toFixed(2));

      if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new BadRequestException("Invalid billing amount calculation");
      }

      // 准备插入数据 - 使用serviceTypeCode字段引用service_types.code
      const ledgerData = {
        relationId: uuidv7(), // Generate valid UUID for relationId (not using sessionId directly)
        sourceEntity: "session",
        mentorUserId: dto.mentorUserId,
        studentUserId: dto.studentUserId,
        serviceTypeCode: dto.serviceTypeCode, // 使用serviceTypeCode字段引用service_types.code
        serviceName: dto.serviceName,
        price: mentorPrice.price.toString(), // Convert numeric to string to match schema
        amount: totalAmount.toString(), // Convert numeric to string to match schema
        currency: mentorPrice.currency,
        createdBy: dto.mentorUserId, // Use mentorUserId as createdBy (valid UUID)
      };

      // 插入记录
      const [ledger] = await this.db
        .insert(schema.mentorPayableLedgers)
        .values(ledgerData)
        .returning();

      this.logger.log(
        `Successfully created per-session billing: ${ledger.id} for session: ${dto.sessionId} with amount: ${totalAmount} ${mentorPrice.currency}`,
      );

      // 转换为接口类型返回
      return this.mapToMentorPayableLedger(ledger);
    } catch (error) {
      this.logger.error(
        `Error creating per-session billing for session: ${dto.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建服务包计费记录
   * @param dto 服务包计费DTO
   * @returns 创建的服务包计费记录
   */
  public async createPackageBilling(
    dto: CreatePackageBillingDto,
  ): Promise<IPackageBilling> {
    try {
      this.logger.log(
        `Creating package billing for contract: ${dto.contractId}`,
      );

      // 输入验证
      if (
        !dto.mentorUserId ||
        !dto.serviceTypeCode ||
        !dto.contractId ||
        !dto.studentUserId
      ) {
        throw new BadRequestException(
          "Missing required fields for package billing creation",
        );
      }

      if (dto.quantity <= 0) {
        throw new BadRequestException("Quantity must be greater than zero");
      }

      // 获取导师价格 - 使用serviceTypeCode查询mentorPrices表
      const mentorPrice = await this.getMentorPrice(
        dto.mentorUserId,
        dto.serviceTypeCode,
      );

      if (!mentorPrice) {
        throw new BadRequestException(
          `No active price found for mentor: ${dto.mentorUserId} and service type: ${dto.serviceTypeCode}`,
        );
      }

      // 计算总金额 - 使用toFixed保持金融计算精度
      const unitPrice = Number(mentorPrice.price);
      const totalAmount = Number((unitPrice * dto.quantity).toFixed(2));

      if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new BadRequestException(
          "Invalid package billing amount calculation",
        );
      }

      // 准备插入数据 - 使用serviceTypeCode字段引用service_types.code
      const ledgerData = {
        relationId: dto.contractId,
        sourceEntity: "contract",
        mentorUserId: dto.mentorUserId,
        studentUserId: dto.studentUserId,
        serviceTypeCode: dto.serviceTypeCode, // 使用serviceTypeCode字段引用service_types.code
        serviceName: dto.serviceName,
        price: String(mentorPrice.price ?? 0), // Convert numeric to string to match schema
        amount: String(totalAmount ?? 0), // Convert numeric to string to match schema
        currency: mentorPrice.currency,
        servicePackageId: dto.servicePackageId,
        createdBy: dto.mentorUserId, // Use valid UUID from DTO
      };

      // 插入记录
      const [ledger] = await this.db
        .insert(schema.mentorPayableLedgers)
        .values(ledgerData)
        .returning();

      this.logger.log(
        `Successfully created package billing: ${ledger.id} for contract: ${dto.contractId} with amount: ${totalAmount} ${mentorPrice.currency}`,
      );

      // 返回包计费记录
      return {
        id: ledger.id,
        contractId: dto.contractId,
        mentorUserId: dto.mentorUserId,
        studentUserId: dto.studentUserId,
        serviceTypeCode: dto.serviceTypeCode, // 使用serviceTypeCode字段
        serviceName: dto.serviceName,
        quantity: dto.quantity,
        unitPrice,
        totalAmount,
        currency: mentorPrice.currency,
        status: "pending",
        createdAt: ledger.createdAt,
        updatedAt: ledger.createdAt, // 由于表结构设计是immutable，这里使用createdAt
        metadata: dto.metadata || {},
      };
    } catch (error) {
      this.logger.error(
        `Error creating package billing for contract: ${dto.contractId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 调整应付账款
   * Adjust payable ledger(创建新的调整记录，不是乘法系数)
   * @param dto 调整DTO
   * @returns 调整后的应付账款记录
   *
   * @remarks 注意：该方法会创建新的调整记录，而不是修改原有记录，保证财务数据的不可变性和可审计性。
   * 调整金额为实际调整值（正数表示增加应付，负数表示退款），而不是乘法系数。
   *
   * @example
   * 原始记录: amount = 100.0 USD
   * 退款场景: adjustmentAmount = -50.0 USD
   *         创建调整记录: amount = 50.0 USD (实际该次调整记录的值)
   *         最终结果: 100 + (-0) = 50 USD (包记录之和)
   *
   * @example
   * 二次调整: adjustmentAmount = 20.0 USD (第一次调整错误，需要补扣)
   *         创建调整记录: amount = 20.0 USD
   *         最终结果: 100 + (-50) + 20 = 70 USD
   */
  public async adjustPayableLedger(
    dto: AdjustPayableLedgerDto,
  ): Promise<IMentorPayableLedger> {
    try {
      this.logger.log(`Adjusting payable ledger: ${dto.ledgerId}`);

      // Input validation
      if (!dto.ledgerId || !dto.createdBy || !dto.reason) {
        throw new BadRequestException(
          "Missing required fields for ledger adjustment",
        );
      }

      // Validate adjustment amount
      if (
        typeof dto.adjustmentAmount !== "number" ||
        isNaN(dto.adjustmentAmount)
      ) {
        throw new BadRequestException("Invalid adjustment amount");
      }

      // Query original record
      const originalLedger = await this.db.query.mentorPayableLedgers.findFirst(
        {
          where: eq(schema.mentorPayableLedgers.id, dto.ledgerId),
        },
      );

      if (!originalLedger) {
        throw new BadRequestException(`Ledger not found: ${dto.ledgerId}`);
      }

      // Adjustment amount is the actual adjustment value, not a multiplier
      const adjustmentAmount = Number(dto.adjustmentAmount.toFixed(2));

      // Validate adjusted amount
      if (isNaN(adjustmentAmount)) {
        throw new BadRequestException(
          "Invalid adjustment amount after precision rounding",
        );
      }

      // Check if it's a valid adjustment (not zero)
      if (adjustmentAmount === 0) {
        throw new BadRequestException(
          "No amount change detected for adjustment",
        );
      }

      // Prepare adjustment record - 使用serviceTypeCode字段引用service_types.code
      const adjustmentData: any = {
        originalId: dto.ledgerId,
        relationId: originalLedger.relationId,
        sourceEntity: originalLedger.sourceEntity,
        mentorUserId: originalLedger.mentorUserId,
        studentUserId: originalLedger.studentUserId || undefined,
        serviceTypeCode: originalLedger.serviceTypeCode, // 使用serviceTypeCode字段引用service_types.code
        serviceName: originalLedger.serviceName,
        price: originalLedger.price.toString(), // Convert numeric to string to match schema
        amount: adjustmentAmount, // This is the adjustment value (can be negative for refunds)
        currency: originalLedger.currency,
        adjustmentReason: dto.reason,
        servicePackageId: originalLedger.servicePackageId || undefined,
        createdBy: dto.createdBy,
      };

      // Insert adjustment record
      const [adjustmentLedger] = await this.db
        .insert(schema.mentorPayableLedgers)
        .values(adjustmentData)
        .returning();

      this.logger.log(
        `Successfully adjusted payable ledger: ${adjustmentLedger.id}. Adjustment amount: ${adjustmentAmount}, Reason: ${dto.reason}`,
      );

      return this.mapToMentorPayableLedger(adjustmentLedger);
    } catch (error) {
      this.logger.error(
        `Error adjusting payable ledger: ${dto.ledgerId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 获取导师价格
   * @param mentorId 导师ID
   * @param serviceTypeCode 服务类型代码(引用service_types.code)
   * @returns 导师价格或null
   *
   * @remarks 价格查询是金融计算的基础，需要确保返回准确的数值
   */
  public async getMentorPrice(
    mentorId: string,
    serviceTypeCode: string,
  ): Promise<IMentorPrice | null> {
    try {
      // 输入验证
      if (!mentorId || !serviceTypeCode) {
        this.logger.warn(
          "Empty mentorId or serviceTypeCode provided to getMentorPrice",
        );
        return null;
      }

      // 查询导师的有效价格 - 通过service_types.code关联mentorPrices表
      // 需要先通过serviceTypeCode查询service_types表获取id，再查询mentorPrices表
      const serviceType = await this.db.query.serviceTypes.findFirst({
        where: eq(schema.serviceTypes.code, serviceTypeCode),
      });

      if (!serviceType) {
        this.logger.warn(`Service type not found for code: ${serviceTypeCode}`);
        return null;
      }

      // 使用serviceTypeCode查询mentorPrices表
      const mentorPrice = await this.db.query.mentorPrices.findFirst({
        where: and(
          eq(schema.mentorPrices.mentorUserId, mentorId),
          eq(schema.mentorPrices.serviceTypeCode, serviceTypeCode), // 使用serviceTypeCode
          eq(schema.mentorPrices.status, "active"),
        ),
      });

      if (!mentorPrice) {
        this.logger.debug(
          `No active price found for mentor: ${mentorId}, service type code: ${serviceTypeCode}`,
        );
        return null;
      }

      // 验证价格的有效性
      const priceValue = Number(mentorPrice.price);
      if (isNaN(priceValue) || priceValue <= 0) {
        this.logger.warn(
          `Invalid price value found for mentor: ${mentorId}, service type code: ${serviceTypeCode}, price: ${mentorPrice.price}`,
        );
        return null;
      }

      // 转换为接口类型返回
      return {
        id: mentorPrice.id,
        mentorUserId: mentorPrice.mentorUserId,
        serviceTypeCode: serviceTypeCode, // 返回serviceTypeCode
        price: priceValue,
        currency: mentorPrice.currency || "USD", // 提供默认货币
        createdAt: mentorPrice.createdAt,
        updatedAt: mentorPrice.updatedAt,
        status: mentorPrice.status,
      };
    } catch (error) {
      this.logger.error(
        `Error getting mentor price for mentor: ${mentorId}, service type code: ${serviceTypeCode}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Query mentor payable ledgers
   * 查询导师应付账款
   *
   * @remarks 金融查询需要确保参数验证和防止SQL注入
   */
  public async queryMentorPayableLedgers(params: {
    mentorUserId?: string;
    startDate?: Date;
    endDate?: Date;
    sourceEntity?: "session" | "contract";
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: IMentorPayableLedger[]; total: number }> {
    try {
      // 参数验证和安全检查
      const validatedPage = Math.max(1, Number(params.page) || 1);
      // 限制最大查询数量，防止过大的查询影响性能
      const validatedPageSize = Math.max(
        1,
        Math.min(100, Number(params.pageSize) || 20),
      );

      if (validatedPage !== params.page) {
        this.logger.warn(
          `Invalid page parameter provided: ${params.page}, using: ${validatedPage}`,
        );
      }

      if (validatedPageSize !== params.pageSize) {
        this.logger.warn(
          `Invalid pageSize parameter provided: ${params.pageSize}, using: ${validatedPageSize}`,
        );
      }

      const { mentorUserId, startDate, endDate, sourceEntity, status } = params;

      // Build query conditions with parameter validation
      const conditions = [];

      // 使用安全的参数添加到查询条件中
      if (
        mentorUserId &&
        typeof mentorUserId === "string" &&
        mentorUserId.trim()
      ) {
        conditions.push(
          eq(schema.mentorPayableLedgers.mentorUserId, mentorUserId.trim()),
        );
      }

      // 日期验证和查询条件
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (!isNaN(startDateObj.getTime())) {
          conditions.push(
            gte(schema.mentorPayableLedgers.createdAt, startDateObj),
          );
        } else {
          this.logger.warn(`Invalid startDate provided: ${startDate}`);
        }
      }

      if (endDate) {
        const endDateObj = new Date(endDate);
        if (!isNaN(endDateObj.getTime())) {
          conditions.push(
            lte(schema.mentorPayableLedgers.createdAt, endDateObj),
          );
        } else {
          this.logger.warn(`Invalid endDate provided: ${endDate}`);
        }
      }

      if (sourceEntity && ["session", "contract"].includes(sourceEntity)) {
        conditions.push(
          eq(schema.mentorPayableLedgers.sourceEntity, sourceEntity),
        );
      }

      // Handle status filtering with validation
      if (status && typeof status === "string") {
        if (status === "adjusted") {
          conditions.push(
            not(eq(schema.mentorPayableLedgers.originalId, null)),
          );
        } else if (status === "original") {
          conditions.push(eq(schema.mentorPayableLedgers.originalId, null));
        }
      }

      // Calculate offset, prevent negative offset
      const offset = Math.max(0, (validatedPage - 1) * validatedPageSize);

      // Get total count
      const totalResult = await this.db
        .select({ count: count() })
        .from(schema.mentorPayableLedgers)
        .where(and(...conditions));

      const total = totalResult[0]?.count || 0;

      // Get paginated data
      const ledgers = await this.db.query.mentorPayableLedgers.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.mentorPayableLedgers.createdAt)],
        limit: validatedPageSize,
        offset: offset,
      });

      // Transform to interface
      const data = ledgers.map((ledger) =>
        this.mapToMentorPayableLedger(ledger),
      );

      return { data, total };
    } catch (error) {
      this.logger.error(
        `Error querying mentor payable ledgers: ${JSON.stringify(params)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * 创建导师价格配置
   * Create mentor price configuration
   *
   * @param dto - Create mentor price DTO
   * @returns Created mentor price record
   */
  public async createMentorPrice(
    dto: CreateMentorPriceDto,
  ): Promise<IMentorPrice> {
    try {
      this.logger.log(
        `Creating mentor price for mentor: ${dto.mentorUserId}, service type: ${dto.serviceTypeCode}`,
      );

      // 参数验证
      if (
        !dto.mentorUserId ||
        !dto.serviceTypeCode ||
        !dto.billingMode ||
        dto.price === undefined ||
        dto.price <= 0
      ) {
        throw new BadRequestException(
          "Invalid parameters: mentorUserId, serviceTypeCode, billingMode, and positive price are required",
        );
      }

      // 验证 billing mode - Uses billingModeEnum values
      const validBillingModes = ["one_time", "per_session", "staged"] as const;
      if (!validBillingModes.includes(dto.billingMode as any)) {
        throw new BadRequestException(
          `Invalid billing mode: ${dto.billingMode}. Must be one of: ${validBillingModes.join(", ")}`,
        );
      }

      // 通过serviceTypeCode查询service_types表获取id
      const serviceType = await this.db.query.serviceTypes.findFirst({
        where: eq(schema.serviceTypes.code, dto.serviceTypeCode),
      });

      if (!serviceType) {
        throw new BadRequestException(
          `Service type not found for code: ${dto.serviceTypeCode}`,
        );
      }

      // 准备数据 - 使用serviceType.id引用service_types表
      const priceRecord = {
        mentorUserId: dto.mentorUserId,
        serviceTypeCode: dto.serviceTypeCode, // 使用serviceTypeCode引用service_types.code
        billingMode: dto.billingMode,
        price: dto.price.toString(),
        currency: dto.currency || "USD",
        status: dto.status || "active",
        updatedBy: dto.updatedBy,
      };

      // 插入数据库
      const [createdPrice] = await this.db
        .insert(schema.mentorPrices)
        .values(priceRecord)
        .returning();

      if (!createdPrice) {
        throw new Error("Failed to create mentor price record");
      }

      this.logger.log(
        `Successfully created mentor price: ${createdPrice.id} for mentor: ${dto.mentorUserId}`,
      );

      // 转换为接口返回类型
      return {
        id: createdPrice.id,
        mentorUserId: createdPrice.mentorUserId,
        serviceTypeCode: dto.serviceTypeCode, // 返回serviceTypeCode而不是serviceType.id
        price: Number(createdPrice.price),
        currency: createdPrice.currency || "USD",
        createdAt: createdPrice.createdAt,
        updatedAt: createdPrice.updatedAt,
        status: createdPrice.status,
      };
    } catch (error) {
      this.logger.error(
        `Error creating mentor price for mentor: ${dto?.mentorUserId}, service type code: ${dto?.serviceTypeCode}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get session billing record
   * 获取会话计费记录
   */
  public async getSessionBilling(
    sessionId: string,
  ): Promise<IMentorPayableLedger | null> {
    const ledger = await this.db.query.mentorPayableLedgers.findFirst({
      where: and(
        eq(schema.mentorPayableLedgers.relationId, sessionId),
        eq(schema.mentorPayableLedgers.sourceEntity, "session"),
        eq(schema.mentorPayableLedgers.originalId, null),
      ),
    });

    if (!ledger) {
      return null;
    }

    return this.mapToMentorPayableLedger(ledger);
  }

  /**
   * Get package billing records
   * 获取服务包计费记录
   */
  public async getPackageBilling(
    contractId: string,
  ): Promise<IPackageBilling | null> {
    const ledger = await this.db.query.mentorPayableLedgers.findFirst({
      where: and(
        eq(schema.mentorPayableLedgers.relationId, contractId),
        eq(schema.mentorPayableLedgers.sourceEntity, "contract"),
        not(eq(schema.mentorPayableLedgers.servicePackageId, null)),
      ),
    });

    if (!ledger) {
      return null;
    }

    // 安全的数值转换函数
    const safeNumberConversion = (
      value: any,
      defaultValue: number = 0,
    ): number => {
      const numValue = Number(value);
      return isNaN(numValue) ? defaultValue : numValue;
    };

    return {
      id: ledger.id || "",
      contractId: ledger.relationId || "",
      mentorUserId: ledger.mentorUserId || "",
      studentUserId: ledger.studentUserId || "",
      serviceTypeCode: ledger.serviceTypeCode || "", // 使用serviceTypeCode
      serviceName: ledger.serviceName || undefined,
      quantity: 1, // 服务包默认数量为1
      unitPrice: safeNumberConversion(ledger.price, 0),
      totalAmount: safeNumberConversion(ledger.amount, 0),
      currency: ledger.currency || "USD",
      status: "pending" as const, // 默认为pending状态
      createdAt: ledger.createdAt || new Date(),
      updatedAt: ledger.createdAt || new Date(),
      metadata: undefined,
    };
  }

  /**
   * Get adjustment chain records
   * 获取调整记录链
   */
  public async getAdjustmentChain(
    originalLedgerId: string,
  ): Promise<IMentorPayableLedger[]> {
    // Get all adjustment records in the chain
    const chainRecords = await this.db.query.mentorPayableLedgers.findMany({
      where: or(
        eq(schema.mentorPayableLedgers.id, originalLedgerId),
        eq(schema.mentorPayableLedgers.originalId, originalLedgerId),
      ),
      orderBy: [asc(schema.mentorPayableLedgers.createdAt)],
    });

    // Transform to interface
    return chainRecords.map((record) => this.mapToMentorPayableLedger(record));
  }

  /**
   * 映射数据库记录到接口类型
   * @param ledger 数据库记录
   * @returns 接口类型记录
   *
   * @remarks 金融数据映射时需要确保数值转换的精确性和安全性
   */
  private mapToMentorPayableLedger(
    ledger: typeof schema.mentorPayableLedgers.$inferSelect,
  ): IMentorPayableLedger {
    // 安全的数值转换，确保返回有效数字
    const safeNumberConversion = (
      value: any,
      defaultValue: number = 0,
    ): number => {
      const numValue = Number(value);
      return isNaN(numValue) ? defaultValue : numValue;
    };

    // 确定billingType
    let billingType: "session" | "package";
    if (ledger.servicePackageId) {
      billingType = "package";
    } else if (ledger.sourceEntity === "session") {
      billingType = "session";
    } else {
      billingType = "session"; // 默认为session
    }

    // 确定状态
    let status: "pending" | "settled" | "adjusted";
    if (ledger.originalId) {
      status = "adjusted";
    } else {
      status = "pending"; // 默认为pending
    }

    return {
      id: ledger.id || "",
      sessionId:
        ledger.sourceEntity === "session" ? ledger.relationId : undefined,
      classId: ledger.sourceEntity === "class" ? ledger.relationId : undefined,
      mentorUserId: ledger.mentorUserId || "",
      studentUserId: ledger.studentUserId || "",
      serviceTypeCode: ledger.serviceTypeCode || "", // 使用serviceTypeCode
      serviceName: ledger.serviceName || undefined,
      durationHours: safeNumberConversion(ledger.price, 0),
      unitPrice: safeNumberConversion(ledger.price, 0),
      totalAmount: safeNumberConversion(ledger.amount, 0),
      currency: ledger.currency || "USD",
      status,
      settlementId: undefined,
      billingType,
      billingId: ledger.id || "",
      adjustmentReason: ledger.adjustmentReason || undefined,
      originalLedgerId: ledger.originalId || undefined,
      createdAt: ledger.createdAt || new Date(),
      updatedAt: ledger.createdAt || new Date(),
      metadata: undefined,
    };
  }
}
