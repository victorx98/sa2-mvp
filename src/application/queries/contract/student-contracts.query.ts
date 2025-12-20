import { Inject, Injectable, Logger } from "@nestjs/common";
import { ContractService } from "@domains/contract/services/contract.service";
import type { StudentContractResponseDto } from "@domains/contract/dto/student-contracts-query.dto";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { sql, and, SQL } from "drizzle-orm";

/**
 * Student Contracts Query (Application Layer)
 * 职责：
 * 1. 编排学生合同查询用例
 * 2. 调用 Contract Domain 的 ContractService
 * 3. 返回格式化的合同和产品信息
 */
@Injectable()
export class StudentContractsQuery {
  private readonly logger = new Logger(StudentContractsQuery.name);

  constructor(
    private readonly contractService: ContractService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 将蛇形命名转换为驼峰命名
   */
  private snakeToCamel(str: string): string {
    // 处理下划线的情况
    const withCamelCase = str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    
    // 特别处理startdate为startDate
    if (withCamelCase.toLowerCase() === 'startdate') {
      return 'startDate';
    }
    
    // 确保第一个字母小写，后续单词首字母大写
    return withCamelCase.charAt(0).toLowerCase() + withCamelCase.slice(1);
  }

  /**
   * 转换对象的所有属性从蛇形命名到驼峰命名
   */
  private transformToCamelCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.transformToCamelCase(item));
    }

    const transformed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      transformed[this.snakeToCamel(key)] = this.transformToCamelCase(value);
    }
    return transformed;
  }

  /**
   * Get contracts purchased by a specific student (获取指定学生购买的合同)
   * @param studentId Student ID (学生ID)
   * @returns List of contracts with product information (包含产品信息的合同列表)
   */
  async getStudentContracts(
    studentId: string,
  ): Promise<StudentContractResponseDto[]> {
    const result = await this.contractService.search(
      { studentId },
      undefined,
      { field: "createdAt", order: "desc" },
    );

    return result.data.map((contract) => ({
      id: contract.id,
      contract_number: contract.contractNumber,
      product: {
        id: contract.productSnapshot.productId,
        name: contract.productSnapshot.productName,
      },
      status: contract.status,
    }));
  }

  /**
   * Get paginated contracts list with filters (获取带筛选的分页合同列表)
   * @param filters Filter conditions (筛选条件)
   * @param pagination Pagination parameters (分页参数)
   * @returns Paginated contracts list (分页合同列表)
   */
  async getContractsWithPagination(filters: {
    studentId?: string;
    status?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
  }, pagination: { page: number; pageSize: number }) {
    const { studentId, status, productId, startDate, endDate, keyword } = filters;

    // Build date filters
    const dateFilters: { signedAfter?: Date; signedBefore?: Date } = {};
    if (startDate) {
      dateFilters.signedAfter = new Date(startDate);
    }
    if (endDate) {
      dateFilters.signedBefore = new Date(endDate);
    }

    const result = await this.contractService.search(
      {
        studentId,
        status,
        productId,
        keyword,
        ...dateFilters,
      },
      pagination,
      { field: "createdAt", order: "desc" },
    );

    return {
      data: result.data.map((contract) => ({
        id: contract.id,
        contract_number: contract.contractNumber,
        product: {
          id: contract.productSnapshot.productId,
          name: contract.productSnapshot.productName,
        },
        status: contract.status,
        studentId: contract.studentId,
        totalAmount: contract.totalAmount,
        currency: contract.currency,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  /**
   * Get all service type consumption records (获取所有服务类型权益消费记录)
   * @param filters Filter conditions (筛选条件)
   * @param pagination Pagination parameters (分页参数)
   * @param sort Sort parameters (排序参数)
   * @returns List of service type consumption records (服务类型权益消费记录列表)
   */
  async getServiceTypeConsumptionRecords(filters?: {
    studentId?: string;
    mentorId?: string;
    status?: string;
  }, pagination?: {
    page?: number;
    pageSize?: number;
  }, sort?: {
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    this.logger.log("Getting service type consumption records with filters", filters);

    const {
      studentId,
      mentorId,
      status,
    } = filters || {};

    const {
      page = 1,
      pageSize = 20,
    } = pagination || {};

    const {
      sortField = 'startDate',
      sortOrder = 'desc',
    } = sort || {};

    // 构建过滤条件（使用参数化查询防止SQL注入）
    const whereConditions: SQL[] = [];

    if (studentId) {
      whereConditions.push(sql`student_id = ${studentId}`);
    }

    if (mentorId) {
      whereConditions.push(sql`mentor_user_id = ${mentorId}`);
    }

    if (status) {
      whereConditions.push(sql`status = ${status}`);
    }

    // 计算分页偏移量
    const offset = (page - 1) * pageSize;

    // 构建完整的SQL查询（使用参数化查询）
    // 提取公共CTE部分，避免重复定义
    const cteQuery = `
      WITH all_services AS (
        -- 常规辅导会话
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          sr.completed_time AS startDate,
          rms.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN regular_mentoring_sessions rms ON sr.id = rms.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
        UNION ALL
        -- 差距分析会话
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          sr.completed_time AS startDate,
          gas.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN gap_analysis_sessions gas ON sr.id = gas.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
        UNION ALL
        -- AI职业规划会话
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          sr.completed_time AS startDate,
          acs.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN ai_career_sessions acs ON sr.id = acs.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
        UNION ALL
        -- 班级会话
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          sr.completed_time AS startDate,
          cs.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN class_sessions cs ON sr.id = cs.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
        UNION ALL
        -- 简历服务
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          sr.completed_time AS startDate,
          r.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN resumes r ON sr.id = r.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
        UNION ALL
        -- 投递申请服务
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          ja.submitted_at AS startDate,
          ja.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN job_applications ja ON sr.id = ja.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
        UNION ALL
        -- 沟通会话
        SELECT
          sr.id,
          sr.service_type,
          sr.title,
          sr.student_user_id AS student_id,
          sr.provider_user_id AS mentor_user_id,
          sr.consumed_units,
          sr.unit_type,
          sr.completed_time AS startDate,
          cs.status,
          u.name_zh AS mentor_name,
          u.name_en AS mentor_name_en
        FROM service_references sr
        INNER JOIN comm_sessions cs ON sr.id = cs.id
        INNER JOIN "user" u ON sr.provider_user_id = u.id
      )
    `;

    // 构建排序子句（使用更安全的方式）
    // 只允许特定字段排序，防止SQL注入
    const allowedSortFields = [
      'id',
      'service_type',
      'title',
      'student_id',
      'mentor_user_id',
      'mentor_name',
      'consumed_units',
      'unit_type',
      'startDate',
      'status',
    ];

    // 安全处理排序字段，使用白名单验证
    const safeSortField = allowedSortFields.includes(sortField || '')
      ? sortField
      : 'startDate';
    // 安全处理排序方向
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 使用安全的方式构建排序子句，避免使用sql.raw
    // 通过将排序字段和方向映射到固定值，确保不会引入SQL注入风险
    const orderByMapping: Record<string, string> = {};
    allowedSortFields.forEach(field => {
      orderByMapping[field] = field;
    });
    const orderByDirectionMapping: Record<string, string> = {
      'ASC': 'ASC',
      'DESC': 'DESC'
    };
    // 构建安全的排序子句
    const safeOrderByClause = `${orderByMapping[safeSortField]} ${orderByDirectionMapping[safeSortOrder]}`;

    // 构建主查询
    const baseQuery = sql.raw(`${cteQuery}
      SELECT
        id,
        service_type,
        title,
        student_id,
        mentor_user_id,
        mentor_name,
        mentor_name_en,
        consumed_units,
        unit_type,
        startDate,
        status
      FROM all_services
    `);

    // 简化WHERE条件构建
    const whereClause = whereConditions.length > 0
      ? (whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions)!) 
      : null;

    // 构建完整的查询
    let finalQuery: SQL;
    if (whereClause) {
      finalQuery = sql`${baseQuery} WHERE ${whereClause}`;
    } else {
      finalQuery = baseQuery;
    }

    // 添加安全的排序和分页
    const orderByClause = sql.raw(`ORDER BY ${safeOrderByClause}`);
    const limitOffsetClause = sql`LIMIT ${pageSize} OFFSET ${offset}`;
    finalQuery = sql`${finalQuery} ${orderByClause} ${limitOffsetClause}`;

    // 使用参数化查询执行
    const consumptionRecords = await this.db.execute(finalQuery);

    // 构建总记录数查询（使用公共CTE，避免重复定义）
    const countBaseQuery = sql.raw(`${cteQuery}
      SELECT COUNT(*) AS total
      FROM all_services
    `);

    // 构建WHERE条件（复用相同的条件）
    let countQuery: SQL;
    if (whereClause) {
      countQuery = sql`${countBaseQuery} WHERE ${whereClause}`;
    } else {
      countQuery = countBaseQuery;
    }

    // 获取总记录数（使用参数化查询）
    const totalRecords = await this.db.execute(countQuery);

    const total = Number(totalRecords.rows[0].total || 0);
    const totalPages = Math.ceil(total / pageSize);

    // 转换数据为驼峰命名
    const transformedRecords = this.transformToCamelCase(consumptionRecords.rows);

    this.logger.log(`Retrieved ${transformedRecords.length} service type consumption records out of ${total} total records`);

    return {
      data: transformedRecords,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

