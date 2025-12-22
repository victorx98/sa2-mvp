import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, asc, desc } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { IMentorPriceService } from "../interfaces/mentor-price.interface";
import { CreateMentorPriceRequestDto } from "@api/dto/request/financial/mentor-price.request.dto";
import { UpdateMentorPriceRequestDto } from "@api/dto/request/financial/mentor-price.request.dto";
import {
  validateMentorPrice,
  validateCurrency,
  validateStatus,
} from "../common/utils/validation.utils";
import {
  FinancialException,
  FinancialNotFoundException,
  FinancialConflictException,
} from "../common/exceptions/financial.exception";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Mentor Price Service[导师价格服务]
 *
 * Implementation of mentor price management operations[导师价格管理操作的实现]
 */
@Injectable()
export class MentorPriceService implements IMentorPriceService {
  private readonly logger = new Logger(MentorPriceService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Get mentor price by mentor user ID and session type code[根据导师用户ID和会话类型代码获取导师价格]
   *
   * @param mentorUserId - Mentor user ID[导师用户ID]
   * @param sessionTypeCode - Session type code[会话类型代码]
   * @returns Mentor price record or null if not found[导师价格记录或未找到时返回null]
   */
  public async getMentorPrice(
    mentorUserId: string,
    sessionTypeCode: string,
  ): Promise<MentorPrice | null> {
    try {
      if (!mentorUserId || !sessionTypeCode) {
        this.logger.warn(
          "Empty mentorUserId or sessionTypeCode provided to getMentorPrice",
        );
        return null;
      }

      const mentorPrice = await this.db.query.mentorPrices.findFirst({
        where: and(
          eq(schema.mentorPrices.mentorUserId, mentorUserId),
          eq(schema.mentorPrices.sessionTypeCode, sessionTypeCode),
          eq(schema.mentorPrices.status, "active"),
        ),
      });

      return mentorPrice || null;
    } catch (error) {
      this.logger.error(
        `Error getting mentor price for mentor: ${mentorUserId}, session type: ${sessionTypeCode}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Create a new mentor price record[创建新的导师价格记录]
   *
   * @param dto - Create mentor price DTO[创建导师价格DTO]
   * @param updatedBy - User ID who created the price[创建价格的用户ID]
   * @returns Created mentor price record[创建的导师价格记录]
   */
  public async createMentorPrice(
    dto: CreateMentorPriceRequestDto,
    updatedBy?: string,
  ): Promise<MentorPrice> {
    try {
      // Validate input data[验证输入数据]
      validateMentorPrice(dto.price);
      if (dto.currency) {
        validateCurrency(dto.currency);
      }
      if (dto.status) {
        validateStatus(dto.status);
      }

      // Check if mentor price already exists[检查导师价格是否已存在]
      const existingPrice = await this.db.query.mentorPrices.findFirst({
        where: and(
          eq(schema.mentorPrices.mentorUserId, dto.mentorUserId),
          eq(schema.mentorPrices.sessionTypeCode, dto.sessionTypeCode),
          eq(schema.mentorPrices.status, "active"),
        ),
      });

      if (existingPrice) {
        throw new FinancialConflictException("MENTOR_PRICE_ALREADY_EXISTS");
      }

      // Create mentor price record[创建导师价格记录]
      const [createdPrice] = await this.db
        .insert(schema.mentorPrices)
        .values({
          mentorUserId: dto.mentorUserId,
          sessionTypeCode: dto.sessionTypeCode,
          price: String(dto.price),
          currency: dto.currency || "USD",
          status: dto.status || "active",
          packageCode: dto.packageCode,
          updatedBy: updatedBy,
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(
        `Created mentor price for mentor: ${dto.mentorUserId}, session type: ${dto.sessionTypeCode}`,
      );

      return createdPrice;
    } catch (error) {
      // If it's already a FinancialException, rethrow it
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error creating mentor price for mentor: ${dto.mentorUserId}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Otherwise, wrap and throw
      throw new FinancialException(
        "MENTOR_PRICE_CREATION_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to create mentor price",
      );
    }
  }

  /**
   * Update an existing mentor price record[更新现有的导师价格记录]
   *
   * @param id - Mentor price ID[导师价格ID]
   * @param dto - Update mentor price DTO[更新导师价格DTO]
   * @param updatedBy - User ID who updated the price[更新价格的用户ID]
   * @returns Updated mentor price record[更新后的导师价格记录]
   */
  public async updateMentorPrice(
    id: string,
    dto: UpdateMentorPriceRequestDto,
    updatedBy?: string,
  ): Promise<MentorPrice> {
    try {
      // Validate input data[验证输入数据]
      if (dto.price !== undefined) {
        validateMentorPrice(dto.price);
      }
      if (dto.currency) {
        validateCurrency(dto.currency);
      }
      if (dto.status) {
        validateStatus(dto.status);
      }

      // Check if mentor price exists[检查导师价格是否存在]
      const existingPrice = await this.db.query.mentorPrices.findFirst({
        where: eq(schema.mentorPrices.id, id),
      });

      if (!existingPrice) {
        throw new FinancialNotFoundException("MENTOR_PRICE_NOT_FOUND");
      }

      // Update mentor price record[更新导师价格记录]
      const [updatedPrice] = await this.db
        .update(schema.mentorPrices)
        .set({
          price:
            dto.price !== undefined ? String(dto.price) : existingPrice.price,
          currency: dto.currency ?? existingPrice.currency,
          status: dto.status ?? existingPrice.status,
          packageCode: dto.packageCode ?? existingPrice.packageCode,
          updatedBy: updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(schema.mentorPrices.id, id))
        .returning();

      this.logger.log(`Updated mentor price: ${id}`);

      return updatedPrice;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error updating mentor price: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "MENTOR_PRICE_UPDATE_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to update mentor price",
      );
    }
  }

  /**
   * Update mentor price status[更新导师价格状态]
   *
   * @param id - Mentor price ID[导师价格ID]
   * @param status - Status to update (active/inactive)[要更新的状态(active/inactive)]
   * @param updatedBy - User ID who updated the status[更新状态的用户ID]
   */
  public async updateMentorPriceStatus(
    id: string,
    status: "active" | "inactive",
    updatedBy?: string,
  ): Promise<void> {
    try {
      // Validate status[验证状态]
      if (status !== "active" && status !== "inactive") {
        throw new FinancialException(
          "INVALID_STATUS",
          "Status must be either 'active' or 'inactive'",
        );
      }

      // Check if mentor price exists[检查导师价格是否存在]
      const existingPrice = await this.db.query.mentorPrices.findFirst({
        where: eq(schema.mentorPrices.id, id),
      });

      if (!existingPrice) {
        throw new FinancialNotFoundException("MENTOR_PRICE_NOT_FOUND");
      }

      if (existingPrice.status === status) {
        this.logger.warn(
          `Mentor price ${id} is already ${status}, skipping update`,
        );
        return;
      }

      // Update mentor price status[更新导师价格状态]
      await this.db
        .update(schema.mentorPrices)
        .set({
          status: status,
          updatedBy: updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(schema.mentorPrices.id, id));

      this.logger.log(`Updated mentor price status: ${id} -> ${status}`);
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error updating mentor price status: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "MENTOR_PRICE_STATUS_UPDATE_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to update mentor price status",
      );
    }
  }

  /**
   * Search mentor prices with filters and pagination[使用过滤器和分页搜索导师价格]
   *
   * @param filter - Filter criteria[过滤条件]
   * @param pagination - Pagination options[分页选项]
   * @param sort - Sorting options[排序选项]
   * @returns Paginated list of mentor prices[分页的导师价格列表]
   */
  public async searchMentorPrices(
    filter: {
      mentorUserId?: string;
      sessionTypeCode?: string;
      status?: string;
      packageCode?: string;
    },
    pagination?: {
      page: number;
      pageSize: number;
    },
    sort?: {
      field: string;
      order: "asc" | "desc";
    },
  ): Promise<{
    data: MentorPrice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      // Build filter conditions[构建过滤条件]
      const conditions = [];
      if (filter.mentorUserId) {
        conditions.push(eq(schema.mentorPrices.mentorUserId, filter.mentorUserId));
      }
      if (filter.sessionTypeCode) {
        conditions.push(
          eq(schema.mentorPrices.sessionTypeCode, filter.sessionTypeCode),
        );
      }
      if (filter.status) {
        conditions.push(eq(schema.mentorPrices.status, filter.status));
      }
      if (filter.packageCode) {
        conditions.push(
          eq(schema.mentorPrices.packageCode, filter.packageCode),
        );
      }

      // Build where clause[构建where子句]
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Calculate pagination[计算分页]
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10;
      const offset = (page - 1) * pageSize;

      // Build sort options[构建排序选项]
      const sortOptions = [];
      if (sort?.field) {
        const sortFn = sort.order === "desc" ? desc : asc;
        // Handle sorting safely for dynamic fields[安全处理动态排序字段]
        const sortableColumnMap = {
          id: schema.mentorPrices.id,
          mentorUserId: schema.mentorPrices.mentorUserId,
          sessionTypeCode: schema.mentorPrices.sessionTypeCode,
          price: schema.mentorPrices.price,
          currency: schema.mentorPrices.currency,
          status: schema.mentorPrices.status,
          packageCode: schema.mentorPrices.packageCode,
          updatedBy: schema.mentorPrices.updatedBy,
          createdAt: schema.mentorPrices.createdAt,
          updatedAt: schema.mentorPrices.updatedAt,
        } as const;

        type SortField = keyof typeof sortableColumnMap;
        const isSortField = (field: string): field is SortField =>
          Object.prototype.hasOwnProperty.call(sortableColumnMap, field);

        if (isSortField(sort.field)) {
          sortOptions.push(sortFn(sortableColumnMap[sort.field]));
        } else {
          // Default sort if invalid field is provided[字段不合法时使用默认排序]
          sortOptions.push(desc(schema.mentorPrices.updatedAt));
        }
      } else {
        // Default sort by updatedAt desc[默认按updatedAt降序排序]
        sortOptions.push(desc(schema.mentorPrices.updatedAt));
      }

      // Get total count[获取总记录数]
      const totalResult = await this.db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(schema.mentorPrices)
        .where(whereClause)
        .execute();
      const total = totalResult[0]?.count || 0;

      // Get paginated data[获取分页数据]
      const data = await this.db
        .select()
        .from(schema.mentorPrices)
        .where(whereClause)
        .orderBy(...sortOptions)
        .limit(pageSize)
        .offset(offset)
        .execute();

      // Calculate total pages[计算总页数]
      const totalPages = Math.ceil(total / pageSize);

      this.logger.log(
        `Searched mentor prices with filter: ${JSON.stringify(filter)}, page: ${page}, pageSize: ${pageSize}, total: ${total}`,
      );

      return {
        data,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Error searching mentor prices: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "MENTOR_PRICE_SEARCH_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to search mentor prices",
      );
    }
  }

  /**
   * Bulk create mentor price records[批量创建导师价格记录]
   *
   * @param dtos - Array of create mentor price DTOs[创建导师价格DTO数组]
   * @param createdBy - User ID who created the prices[创建价格的用户ID]
   * @returns Array of created mentor price records[创建的导师价格记录数组]
   */
  public async batchCreateMentorPrices(
    dtos: CreateMentorPriceRequestDto[],
    createdBy?: string,
  ): Promise<MentorPrice[]> {
    try {
      if (!dtos || dtos.length === 0) {
        return [];
      }

      // Validate all DTOs first[先验证所有DTO]
      for (const dto of dtos) {
        validateMentorPrice(dto.price);
        if (dto.currency) {
          validateCurrency(dto.currency);
        }
        if (dto.status) {
          validateStatus(dto.status);
        }
      }

      // Check for duplicate entries in the same batch[检查批次中是否有重复条目]
      const uniqueCombinations = new Set<string>();
      for (const dto of dtos) {
        const key = `${dto.mentorUserId}-${dto.sessionTypeCode}`;
        if (uniqueCombinations.has(key)) {
          throw new FinancialException(
            "BULK_VALIDATION_FAILED",
            `Duplicate mentorUserId-sessionTypeCode combination found: ${dto.mentorUserId}-${dto.sessionTypeCode}`,
          );
        }
        uniqueCombinations.add(key);
      }

      // Use transaction to ensure atomicity[使用事务确保原子性]
      const createdPrices = await this.db.transaction(async (tx) => {
        const results: MentorPrice[] = [];

        for (const dto of dtos) {
          // Check if mentor price already exists in database[检查数据库中是否已存在导师价格]
          const existingPrice = await tx.query.mentorPrices.findFirst({
            where: and(
              eq(schema.mentorPrices.mentorUserId, dto.mentorUserId),
              eq(schema.mentorPrices.sessionTypeCode, dto.sessionTypeCode),
              eq(schema.mentorPrices.status, "active"),
            ),
          });

          if (existingPrice) {
            throw new FinancialConflictException(
              "MENTOR_PRICE_ALREADY_EXISTS",
              `Mentor price already exists for mentor: ${dto.mentorUserId}, session type: ${dto.sessionTypeCode}`,
            );
          }

          // Insert the mentor price[插入导师价格]
          const [createdPrice] = await tx
            .insert(schema.mentorPrices)
            .values({
              mentorUserId: dto.mentorUserId,
              sessionTypeCode: dto.sessionTypeCode,
              price: String(dto.price),
              currency: dto.currency || "USD",
              status: dto.status || "active",
              packageCode: dto.packageCode,
              updatedBy: createdBy,
              updatedAt: new Date(),
            })
            .returning();

          results.push(createdPrice);
        }

        return results;
      });

      this.logger.log(`Bulk created ${createdPrices.length} mentor prices`);

      return createdPrices;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error bulk creating mentor prices: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "BULK_OPERATION_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to bulk create mentor prices",
      );
    }
  }

  /**
   * Batch update mentor price records[批量更新导师价格记录]
   *
   * @param updates - Array of update mentor price objects[更新导师价格对象数组]
   * @param updatedBy - User ID who updated the prices[更新价格的用户ID]
   * @returns Array of updated mentor price records[更新后的导师价格记录数组]
   */
  public async batchUpdateMentorPrices(
    updates: Array<{ id: string; dto: UpdateMentorPriceRequestDto }>,
    updatedBy?: string,
  ): Promise<MentorPrice[]> {
    try {
      if (!updates || updates.length === 0) {
        return [];
      }

      // Validate all update DTOs first[先验证所有更新DTO]
      for (const update of updates) {
        const { dto } = update;
        if (dto.price !== undefined) {
          validateMentorPrice(dto.price);
        }
        if (dto.currency) {
          validateCurrency(dto.currency);
        }
        if (dto.status) {
          validateStatus(dto.status);
        }
      }

      // Use transaction to ensure atomicity[使用事务确保原子性]
      const updatedPrices = await this.db.transaction(async (tx) => {
        const results: MentorPrice[] = [];

        for (const update of updates) {
          const { id, dto } = update;

          // Check if mentor price exists[检查导师价格是否存在]
          const existingPrice = await tx.query.mentorPrices.findFirst({
            where: eq(schema.mentorPrices.id, id),
          });

          if (!existingPrice) {
            throw new FinancialNotFoundException(
              "MENTOR_PRICE_NOT_FOUND",
              `Mentor price not found: ${id}`,
            );
          }

          // Update the mentor price[更新导师价格]
          const [updatedPrice] = await tx
            .update(schema.mentorPrices)
            .set({
              price:
                dto.price !== undefined
                  ? String(dto.price)
                  : existingPrice.price,
              currency: dto.currency ?? existingPrice.currency,
              status: dto.status ?? existingPrice.status,
              packageCode: dto.packageCode ?? existingPrice.packageCode,
              updatedBy: updatedBy,
              updatedAt: new Date(),
            })
            .where(eq(schema.mentorPrices.id, id))
            .returning();

          results.push(updatedPrice);
        }

        return results;
      });

      this.logger.log(`Bulk updated ${updatedPrices.length} mentor prices`);

      return updatedPrices;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error bulk updating mentor prices: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "BULK_OPERATION_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to bulk update mentor prices",
      );
    }
  }
}
