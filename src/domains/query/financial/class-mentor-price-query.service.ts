/**
 * Class Mentor Price Query Service
 * (班级导师价格查询服务)
 *
 * This service provides read-only queries for class mentor prices with mentor information
 * (提供班级导师价格的只读查询，包含导师信息)
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, ne, asc, desc, count } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { ClassMentorPriceStatus } from "@shared/types/financial-enums";
import { ClassMentorPriceFilterDto } from "@domains/financial/dto/class-mentor-price-filter.dto";
import { FinancialException } from "@domains/financial/common/exceptions/financial.exception";

/**
 * Mentor information in response
 * (响应中的导师信息)
 */
export interface MentorInfo {
  id: string; // User ID (用户ID)
  nameEn: string | null; // English name (英文名)
  nameZh: string | null; // Chinese name (中文名)
}

/**
 * Class Mentor Price with Mentor Info
 * (包含导师信息的班级导师价格)
 */
export interface ClassMentorPriceWithMentor {
  id: string;
  classId: string;
  mentor: MentorInfo; // Mentor object instead of mentorUserId (导师对象，替代mentorUserId)
  pricePerSession: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated result for class mentor prices
 * (分页的班级导师价格结果)
 */
export interface PaginatedClassMentorPriceResult {
  data: ClassMentorPriceWithMentor[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ClassMentorPriceQueryService {
  private readonly logger = new Logger(ClassMentorPriceQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Find one class mentor price record by dynamic criteria with mentor info
   * (根据动态条件查找单个班级导师价格记录，包含导师信息)
   *
   * @param criteria - Search criteria (id, classId, mentorUserId)
   * @returns Class mentor price record with mentor info or null if not found
   */
  public async findOne(criteria: {
    id?: string;
    classId?: string;
    mentorUserId?: string;
  }): Promise<ClassMentorPriceWithMentor | null> {
    try {
      // Validate that at least one criterion is provided
      if (!criteria.id && !criteria.classId && !criteria.mentorUserId) {
        this.logger.warn("No search criteria provided to findOne");
        return null;
      }

      // Build where conditions dynamically
      const conditions = [];
      if (criteria.id) {
        conditions.push(eq(schema.classMentorsPrices.id, criteria.id));
      }
      if (criteria.classId) {
        conditions.push(eq(schema.classMentorsPrices.classId, criteria.classId));
      }
      if (criteria.mentorUserId) {
        conditions.push(
          eq(schema.classMentorsPrices.mentorUserId, criteria.mentorUserId),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Query with join to user table
      const result = await this.db
        .select({
          id: schema.classMentorsPrices.id,
          classId: schema.classMentorsPrices.classId,
          mentorUserId: schema.classMentorsPrices.mentorUserId,
          pricePerSession: schema.classMentorsPrices.pricePerSession,
          status: schema.classMentorsPrices.status,
          createdAt: schema.classMentorsPrices.createdAt,
          updatedAt: schema.classMentorsPrices.updatedAt,
          mentorId: schema.userTable.id,
          mentorNameEn: schema.userTable.nameEn,
          mentorNameZh: schema.userTable.nameZh,
        })
        .from(schema.classMentorsPrices)
        .leftJoin(
          schema.userTable,
          eq(
            schema.classMentorsPrices.mentorUserId,
            schema.userTable.id,
          ),
        )
        .where(whereClause)
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];

      return {
        id: row.id,
        classId: row.classId,
        mentor: {
          id: row.mentorId || row.mentorUserId,
          nameEn: row.mentorNameEn,
          nameZh: row.mentorNameZh,
        },
        pricePerSession: row.pricePerSession,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error finding class mentor price: ${JSON.stringify(criteria)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_GET_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to get class mentor price",
      );
    }
  }

  /**
   * Search class mentor prices with filters and pagination, including mentor info
   * (搜索班级导师价格，支持过滤和分页，包含导师信息)
   *
   * @param filter - Filter criteria (过滤条件)
   * @param pagination - Pagination options (分页选项)
   * @param sort - Sorting options (排序选项)
   * @returns Paginated list of class mentor prices with mentor info (分页的班级导师价格列表，包含导师信息)
   */
  public async search(
    filter: ClassMentorPriceFilterDto,
    pagination?: {
      page: number;
      pageSize: number;
    },
    sort?: {
      field: string;
      order: "asc" | "desc";
    },
  ): Promise<PaginatedClassMentorPriceResult> {
    try {
      // Build filter conditions (构建过滤条件)
      const conditions = [];
      if (filter.classId) {
        conditions.push(eq(schema.classMentorsPrices.classId, filter.classId));
      }
      if (filter.mentorUserId) {
        conditions.push(
          eq(schema.classMentorsPrices.mentorUserId, filter.mentorUserId),
        );
      }
      if (filter.status) {
        conditions.push(eq(schema.classMentorsPrices.status, filter.status));
      } else {
        // Default: exclude inactive records (默认：排除未激活的记录)
        conditions.push(eq(schema.classMentorsPrices.status, ClassMentorPriceStatus.ACTIVE));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Calculate total count
      const countResult = await this.db
        .select({ total: count() })
        .from(schema.classMentorsPrices)
        .where(whereClause);
      const total = Number(countResult[0]?.total || 0);

      // Set default pagination values if not provided
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 20;
      const offset = (page - 1) * pageSize;
      const totalPages = Math.ceil(total / pageSize);

      // Build sort clause
      const sortField = sort?.field || "createdAt";
      const sortOrder = sort?.order || "desc";

      // Only allow valid column names for sorting
      const validSortFields = ["createdAt", "updatedAt", "pricePerSession"];
      const finalSortField = validSortFields.includes(sortField)
        ? sortField
        : "createdAt";

      // Build order by clause
      let orderBy;
      if (finalSortField === "createdAt") {
        orderBy =
          sortOrder === "asc"
            ? asc(schema.classMentorsPrices.createdAt)
            : desc(schema.classMentorsPrices.createdAt);
      } else if (finalSortField === "updatedAt") {
        orderBy =
          sortOrder === "asc"
            ? asc(schema.classMentorsPrices.updatedAt)
            : desc(schema.classMentorsPrices.updatedAt);
      } else {
        orderBy =
          sortOrder === "asc"
            ? asc(schema.classMentorsPrices.pricePerSession)
            : desc(schema.classMentorsPrices.pricePerSession);
      }

      // Get paginated data with mentor info
      const dataQuery = this.db
        .select({
          id: schema.classMentorsPrices.id,
          classId: schema.classMentorsPrices.classId,
          mentorUserId: schema.classMentorsPrices.mentorUserId,
          pricePerSession: schema.classMentorsPrices.pricePerSession,
          status: schema.classMentorsPrices.status,
          createdAt: schema.classMentorsPrices.createdAt,
          updatedAt: schema.classMentorsPrices.updatedAt,
          mentorId: schema.userTable.id,
          mentorNameEn: schema.userTable.nameEn,
          mentorNameZh: schema.userTable.nameZh,
        })
        .from(schema.classMentorsPrices)
        .leftJoin(
          schema.userTable,
          eq(
            schema.classMentorsPrices.mentorUserId,
            schema.userTable.id,
          ),
        )
        .where(whereClause)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset);

      const dataResult = await dataQuery;

      // Map results to response format
      const data: ClassMentorPriceWithMentor[] = dataResult.map((row, index) => {
        return {
          id: row.id,
          classId: row.classId,
          mentor: {
            id: row.mentorId || row.mentorUserId,
            nameEn: row.mentorNameEn,
            nameZh: row.mentorNameZh,
          },
          pricePerSession: row.pricePerSession,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      });

      this.logger.log(
        `Searched class mentor prices: total=${total}, page=${page}, pageSize=${pageSize}`,
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
        `Error searching class mentor prices: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_SEARCH_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to search class mentor prices",
      );
    }
  }
}

