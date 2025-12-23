import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, desc, asc, count } from "drizzle-orm";
import { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { IPaginatedResult } from "@shared/types/paginated-result";
import { ListMentorPricesQueryDto, SortDirection } from "@api/dto/request/financial/mentor-price.request.dto";

export interface MentorPriceWithMentor {
  id: string;
  mentorUserId: string;
  serviceTypeId: string | null;
  sessionTypeCode: string | null;
  packageCode: string | null;
  price: string;
  currency: string;
  status: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  mentorId: string;
  name_cn: string | null;
  name_en: string | null;
}

@Injectable()
export class ListMentorPricesQuery {
  private readonly logger = new Logger(ListMentorPricesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 查询导师价格列表（支持分页和排序）
   * [List mentor prices with pagination and sorting]
   *
   * @param queryDto - 查询参数 [Query parameters]
   * @returns 分页结果 [Paginated result]
   */
  async execute(
    queryDto: ListMentorPricesQueryDto,
  ): Promise<IPaginatedResult<MentorPriceWithMentor>> {
    const { page = 1, pageSize = 20, sortBy = "createdAt", sortDirection = SortDirection.DESC, mentorUserId, status } = queryDto;

    // 构建查询条件 [Build query conditions]
    const conditions = [];

    if (mentorUserId) {
      conditions.push(eq(schema.mentorPrices.mentorUserId, mentorUserId));
    }

    if (status) {
      conditions.push(eq(schema.mentorPrices.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询总数 [Query total count]
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.mentorPrices)
      .where(whereClause);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    // 计算分页参数 [Calculate pagination parameters]
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // 构建排序 [Build sorting]
    const orderByClause = this.buildOrderBy(sortBy, sortDirection);

    // 执行查询 [Execute query]
    const results = await this.db
      .select({
        id: schema.mentorPrices.id,
        mentorUserId: schema.mentorPrices.mentorUserId,
        serviceTypeId: schema.mentorPrices.serviceTypeId,
        sessionTypeCode: schema.mentorPrices.sessionTypeCode,
        packageCode: schema.mentorPrices.packageCode,
        price: schema.mentorPrices.price,
        currency: schema.mentorPrices.currency,
        status: schema.mentorPrices.status,
        updatedBy: schema.mentorPrices.updatedBy,
        createdAt: schema.mentorPrices.createdAt,
        updatedAt: schema.mentorPrices.updatedAt,
        mentorId: schema.userTable.id,
        name_cn: schema.userTable.nameZh,
        name_en: schema.userTable.nameEn,
      })
      .from(schema.mentorPrices)
      .leftJoin(schema.userTable, eq(schema.mentorPrices.mentorUserId, schema.userTable.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // 映射结果 [Map results]
    const data: MentorPriceWithMentor[] = results.map((row) => ({
      id: row.id,
      mentorUserId: row.mentorUserId,
      serviceTypeId: row.serviceTypeId ?? null,
      sessionTypeCode: row.sessionTypeCode ?? null,
      packageCode: row.packageCode ?? null,
      price: String(row.price ?? ""),
      currency: row.currency,
      status: row.status,
      updatedBy: row.updatedBy ?? null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
      mentorId: row.mentorId ?? row.mentorUserId,
      name_cn: row.name_cn ?? null,
      name_en: row.name_en ?? null,
    }));

    return {
      
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * 构建排序子句
   * [Build order by clause]
   */
  private buildOrderBy(
    sortBy: string,
    sortDirection: SortDirection,
  ): ReturnType<typeof desc> | ReturnType<typeof asc> {
    const direction = sortDirection === SortDirection.ASC ? asc : desc;

    switch (sortBy) {
      case "createdAt":
        return direction(schema.mentorPrices.createdAt);
      case "updatedAt":
        return direction(schema.mentorPrices.updatedAt);
      case "price":
        return direction(schema.mentorPrices.price);
      case "mentorUserId":
        return direction(schema.mentorPrices.mentorUserId);
      case "status":
        return direction(schema.mentorPrices.status);
      default:
        return desc(schema.mentorPrices.createdAt);
    }
  }
}
