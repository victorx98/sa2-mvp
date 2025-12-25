/**
 * Drizzle Mentor Price Query Repository Implementation
 * 基于 Drizzle 的导师价格查询仓储实现
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { IPaginatedResult } from "@shared/types/paginated-result";
import { IMentorPriceQueryRepository } from '../../interfaces/mentor-price-query.repository.interface';
import { MentorPriceReadModel } from '../../models/mentor-price-read.model';
import { ListMentorPricesDto, SortDirection } from '../../dto/list-mentor-prices.dto';

@Injectable()
export class DrizzleMentorPriceQueryRepository implements IMentorPriceQueryRepository {
  private readonly logger = new Logger(DrizzleMentorPriceQueryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async listMentorPrices(dto: ListMentorPricesDto): Promise<IPaginatedResult<MentorPriceReadModel>> {
    const { page = 1, pageSize = 20, sortBy = "createdAt", sortDirection = SortDirection.DESC, mentorUserId, status } = dto;

    // Build query conditions
    const conditions = [];

    if (mentorUserId) {
      conditions.push(eq(schema.mentorPrices.mentorUserId, mentorUserId));
    }

    if (status) {
      conditions.push(eq(schema.mentorPrices.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query total count
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.mentorPrices)
      .where(whereClause);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    // Calculate pagination parameters
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Build sorting
    const orderByClause = this.buildOrderBy(sortBy, sortDirection);

    // Execute query
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

    // Map results to Read Model
    const data: MentorPriceReadModel[] = results.map((row) => ({
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

