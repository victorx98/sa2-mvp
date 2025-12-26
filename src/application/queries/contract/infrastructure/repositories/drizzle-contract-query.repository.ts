/**
 * Drizzle Contract Query Repository Implementation
 * 基于 Drizzle 的合同查询仓储实现
 * 
 * Note: This repository contains complex SQL queries with CTEs and UNION ALL
 * 注意：此仓储包含复杂的SQL查询，包括CTE和UNION ALL
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DrizzleDatabase } from "@shared/types/database.types";
import { sql, and, SQL } from "drizzle-orm";
import { IPaginatedResult } from "@shared/types/paginated-result";
import { IContractQueryRepository } from '../../interfaces/contract-query.repository.interface';
import { StudentContractReadModel, ServiceConsumptionReadModel } from '../../models/contract-read.model';
import { GetStudentContractsDto, GetServiceConsumptionDto } from '../../dto/contract-query.dto';
import { ContractService } from "@domains/contract/services/contract.service";

@Injectable()
export class DrizzleContractQueryRepository implements IContractQueryRepository {
  private readonly logger = new Logger(DrizzleContractQueryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {}

  async getStudentContracts(dto: GetStudentContractsDto): Promise<IPaginatedResult<StudentContractReadModel>> {
    const { filters, pagination, sort } = dto;

    // Build date filters
    const dateFilters: { signedAfter?: Date; signedBefore?: Date } = {};
    // Note: startDate/endDate would come from filters if needed

    const result = await this.contractService.search(
      {
        studentId: filters?.studentId,
        status: filters?.status,
        keyword: filters?.productName,
        ...dateFilters,
      },
      {
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
      },
      { field: sort?.field || "createdAt", order: sort?.direction || "desc" },
    );

    const data: StudentContractReadModel[] = result.data.map((contract) => ({
      id: contract.id,
      studentId: contract.studentId,
      productSnapshotId: contract.productSnapshot?.productId || null,
      contractNumber: contract.contractNumber,
      productName: contract.productSnapshot?.productName || '',
      productPrice: String(contract.totalAmount),
      productCurrency: contract.currency,
      status: contract.status,
      signedAt: undefined,
      activatedAt: undefined,
      suspendedAt: undefined,
      resumedAt: undefined,
      completedAt: undefined,
      terminatedAt: undefined,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    }));

    return {
      data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async getServiceTypeConsumptionRecords(dto: GetServiceConsumptionDto): Promise<IPaginatedResult<ServiceConsumptionReadModel>> {
    this.logger.log("Getting service type consumption records with filters", dto.filters);

    const { filters, pagination, sort } = dto;
    const {
      studentId,
      contractId,
      serviceTypeCode,
      status,
    } = filters || {};

    const {
      page = 1,
      pageSize = 20,
    } = pagination || {};

    const {
      field: sortField = 'startDate',
      direction: sortOrder = 'desc',
    } = sort || {};

    // Build filter conditions (using parameterized queries to prevent SQL injection)
    const whereConditions: SQL[] = [];

    if (studentId) {
      whereConditions.push(sql`student_id = ${studentId}`);
    }

    if (contractId) {
      whereConditions.push(sql`contract_id = ${contractId}`);
    }

    if (status) {
      whereConditions.push(sql`status = ${status}`);
    }

    if (serviceTypeCode) {
      whereConditions.push(sql`service_type = ${serviceTypeCode}`);
    }

    // Calculate pagination offset
    const offset = (page - 1) * pageSize;

    // Build complete SQL query with CTE
    // This is a complex query that aggregates service consumption across multiple session types
    const cteQuery = `
      WITH all_services AS (
        -- Regular mentoring sessions
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
        -- Gap analysis sessions
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
        -- AI career sessions
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
        -- Class sessions
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
        -- Resume services
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
      )
      SELECT * FROM all_services
    `;

    // Add WHERE clause if conditions exist
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = ` WHERE ${whereConditions.map((_, i) => `condition_${i}`).join(' AND ')}`;
    }

    // Add ORDER BY clause
    const validSortFields = ['startDate', 'service_type', 'status'];
    const safeSortField = validSortFields.includes(sortField) ? sortField : 'startDate';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = ` ORDER BY ${safeSortField} ${safeSortOrder}`;

    // Build final query
    const finalQuery = sql.raw(`
      ${cteQuery}
      ${whereClause}
      ${orderByClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    // Execute query
    const consumptionRecords = await this.db.execute(finalQuery);

    // Get total count
    const countQuery = sql.raw(`
      WITH all_services AS (${cteQuery.replace('SELECT * FROM all_services', 'SELECT 1')})
      SELECT COUNT(*) as total FROM all_services
      ${whereClause}
    `);
    const totalRecords = await this.db.execute(countQuery);
    const total = Number(totalRecords.rows[0]?.total || 0);
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    // Transform results to camelCase
    const transformedRecords = this.transformToCamelCase(consumptionRecords.rows);

    const data: ServiceConsumptionReadModel[] = transformedRecords.map((record: any) => ({
      contractId: record.contractId || '',
      contractNumber: record.contractNumber || '',
      studentId: record.studentId || '',
      studentNameCn: record.studentNameCn || null,
      studentNameEn: record.studentNameEn || null,
      serviceTypeId: record.serviceTypeId || '',
      serviceTypeCode: record.serviceType || '',
      serviceTypeName: record.serviceTypeName || '',
      totalQuantity: Number(record.totalQuantity || 0),
      consumedQuantity: Number(record.consumedQuantity || 0),
      remainingQuantity: Number(record.remainingQuantity || 0),
      lastConsumedAt: record.lastConsumedAt ? new Date(record.lastConsumedAt) : null,
      contractStatus: record.contractStatus || '',
      contractSignedAt: record.contractSignedAt ? new Date(record.contractSignedAt) : null,
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
   * Convert snake_case to camelCase
   */
  private snakeToCamel(str: string): string {
    const withCamelCase = str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    if (withCamelCase.toLowerCase() === 'startdate') {
      return 'startDate';
    }
    return withCamelCase.charAt(0).toLowerCase() + withCamelCase.slice(1);
  }

  /**
   * Transform all object properties from snake_case to camelCase
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
}

