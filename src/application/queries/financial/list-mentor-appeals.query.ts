import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, desc, asc, like } from "drizzle-orm";
import { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { IPaginatedResult } from "@shared/types/paginated-result";
import {
  ListMentorAppealsQueryDto,
  SortDirection,
} from "@api/dto/request/financial/list-mentor-appeals.request.dto";

export interface MentorAppealWithRelations {
  id: string;
  title: string | null;
  appealType: string;
  appealAmount: string;
  currency: string;
  status: string;
  paymentMonth: string;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  mentorId: string;
  mentorNameCn: string | null;
  mentorNameEn: string | null;
  counselorId: string;
  counselorNameCn: string | null;
  counselorNameEn: string | null;
  studentId: string | null;
  studentNameCn: string | null;
  studentNameEn: string | null;
  updatedByName: string;
  updatedAt: Date;
}

@Injectable()
export class ListMentorAppealsQuery {
  private readonly logger = new Logger(ListMentorAppealsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 查询导师申诉列表（支持分页、排序和筛选）
   * [List mentor appeals with pagination, sorting, and filtering]
   */
  async execute(
    queryDto: ListMentorAppealsQueryDto,
  ): Promise<IPaginatedResult<MentorAppealWithRelations>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = "createdAt",
      sortDirection = SortDirection.DESC,
      status,
      mentorId,
      counselorId,
      studentId,
      appealType,
      paymentMonth,
    } = queryDto;

    // 构建查询条件 [Build query conditions]
    const conditions = [];

    if (status) {
      conditions.push(eq(schema.mentorAppeals.status, status));
    }

    if (mentorId) {
      conditions.push(eq(schema.mentorAppeals.mentorId, mentorId));
    }

    if (counselorId) {
      conditions.push(eq(schema.mentorAppeals.counselorId, counselorId));
    }

    if (appealType) {
      conditions.push(eq(schema.mentorAppeals.appealType, appealType));
    }

    if (studentId) {
      // 直接通过 mentor_appeals.student_id 筛选学生 [Filter by student through mentor_appeals.student_id]
      conditions.push(eq(schema.mentorAppeals.studentId, studentId));
    }

    if (paymentMonth) {
      // 筛选支付月份 (YYYY-MM格式) [Filter by payment month (YYYY-MM format)]
      conditions.push(
        like(
          sql`to_char(${schema.mentorAppeals.createdAt}, 'YYYY-MM')`,
          paymentMonth,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询总数 [Query total count]
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.mentorAppeals)
      .where(whereClause);

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    // 计算分页参数 [Calculate pagination parameters]
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // 构建排序 [Build sorting]
    const orderByClause = this.buildOrderBy(sortBy, sortDirection);

    // 定义表别名 [Define table aliases]
    const mentorUser = schema.userTable;
    const counselorUser = schema.userTable;
    const studentUser = schema.userTable;
    const updatedByUser = schema.userTable;

    // 执行查询 [Execute query]
    const results = await this.db
      .select({
        id: schema.mentorAppeals.id,
        title: schema.mentorAppeals.title,
        appealType: schema.mentorAppeals.appealType,
        appealAmount: schema.mentorAppeals.appealAmount,
        currency: schema.mentorAppeals.currency,
        status: schema.mentorAppeals.status,
        paymentMonth: sql<string>`to_char(${schema.mentorAppeals.createdAt}, 'YYYY-MM')`,
        createdAt: schema.mentorAppeals.createdAt,
        approvedAt: schema.mentorAppeals.approvedAt,
        rejectedAt: schema.mentorAppeals.rejectedAt,
        rejectionReason: schema.mentorAppeals.rejectionReason,
        mentorId: schema.mentorAppeals.mentorId,
        mentorNameCn: sql<string | null>`mentor_user.name_zh`,
        mentorNameEn: sql<string | null>`mentor_user.name_en`,
        counselorId: schema.mentorAppeals.counselorId,
        counselorNameCn: sql<string | null>`counselor_user.name_zh`,
        counselorNameEn: sql<string | null>`counselor_user.name_en`,
        studentId: schema.mentorAppeals.studentId,
        studentNameCn: sql<string | null>`student_user.name_zh`,
        studentNameEn: sql<string | null>`student_user.name_en`,
        approvedBy: schema.mentorAppeals.approvedBy,
        rejectedBy: schema.mentorAppeals.rejectedBy,
        createdBy: schema.mentorAppeals.createdBy,
        updatedByNameCn: sql<string | null>`updated_by_user.name_zh`,
        updatedByNameEn: sql<string | null>`updated_by_user.name_en`,
      })
      .from(schema.mentorAppeals)
      .leftJoin(
        sql`"user" as mentor_user`,
        sql`${schema.mentorAppeals.mentorId} = mentor_user.id`,
      )
      .leftJoin(
        sql`"user" as counselor_user`,
        sql`${schema.mentorAppeals.counselorId} = counselor_user.id`,
      )
      .leftJoin(
        sql`"user" as student_user`,
        sql`${schema.mentorAppeals.studentId} = student_user.id`,
      )
      .leftJoin(
        sql`"user" as updated_by_user`,
        sql`COALESCE(${schema.mentorAppeals.approvedBy}, ${schema.mentorAppeals.rejectedBy}, ${schema.mentorAppeals.createdBy}) = updated_by_user.id`,
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // 映射结果 [Map results]
    const data: MentorAppealWithRelations[] = results.map((row) => {
      // 确定更新人 [Determine updater]
      const updatedByName =
        row.updatedByNameCn || row.updatedByNameEn || "Unknown";

      // 确定更新时间 [Determine update time]
      const updatedAt =
        (row.approvedAt as Date | null) ||
        (row.rejectedAt as Date | null) ||
        (row.createdAt as Date);

      return {
        id: row.id,
        title: row.title ?? null,
        appealType: row.appealType,
        appealAmount: String(row.appealAmount ?? ""),
        currency: row.currency,
        status: row.status,
        paymentMonth: row.paymentMonth,
        createdAt: row.createdAt as Date,
        approvedAt: row.approvedAt as Date | null,
        rejectedAt: row.rejectedAt as Date | null,
        rejectionReason: row.rejectionReason ?? null,
        mentorId: row.mentorId,
        mentorNameCn: row.mentorNameCn ?? null,
        mentorNameEn: row.mentorNameEn ?? null,
        counselorId: row.counselorId,
        counselorNameCn: row.counselorNameCn ?? null,
        counselorNameEn: row.counselorNameEn ?? null,
        studentId: row.studentId ?? null,
        studentNameCn: row.studentNameCn ?? null,
        studentNameEn: row.studentNameEn ?? null,
        updatedByName,
        updatedAt,
      };
    });

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
        return direction(schema.mentorAppeals.createdAt);
      case "appealAmount":
        return direction(schema.mentorAppeals.appealAmount);
      case "status":
        return direction(schema.mentorAppeals.status);
      default:
        return desc(schema.mentorAppeals.createdAt);
    }
  }
}

