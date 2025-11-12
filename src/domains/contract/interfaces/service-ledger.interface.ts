/**
 * Service Ledger Service Interface (v2.16.12 - 学生级权益累积制)
 */

import { ServiceLedger } from "@infrastructure/database/schema";
import { IPaginatedResult } from "./contract.interface";

/**
 * Service Ledger Service Interface (v2.16.12 - 学生级权益累积制)
 *
 * @change {v2.16.12} All methods now operate at student level (across all contracts)
 */
export interface IServiceLedgerService {
  recordConsumption(dto: IRecordConsumptionDto): Promise<ServiceLedger>; // Record consumption (记录消费)
  recordAdjustment(dto: IRecordAdjustmentDto): Promise<ServiceLedger>; // Record adjustment (记录调整)
  calculateAvailableBalance(
    studentId: string,
    serviceType: string,
  ): Promise<IBalanceInfo>; // Calculate available balance (计算可用余额)
  queryLedgers(
    filter: ILedgerFilterDto,
    options?: ILedgerQueryOptions,
  ): Promise<IPaginatedResult<ServiceLedger>>; // Query ledgers (查询台账)
  reconcileBalance(studentId: string, serviceType: string): Promise<boolean>; // New in v2.16.12 (v2.16.12新增)
}

/**
 * DTO for recording service consumption (v2.16.12 - 学生级权益累积制)
 *
 * @change {v2.16.12} Removed contractId - now queries by studentId + serviceType across all contracts
 */
export interface IRecordConsumptionDto {
  studentId: string; // Student ID (学生ID) - Primary identifier in v2.16.12
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to consume (消费数量)
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))
  createdBy: string; // ID of creator (创建人ID)
}

/**
 * DTO for recording manual adjustment (v2.16.12 - 学生级权益累积制)
 *
 * @change {v2.16.12} Removed contractId - now queries by studentId + serviceType across all contracts
 */
export interface IRecordAdjustmentDto {
  studentId: string; // Student ID (学生ID) - Primary identifier in v2.16.12
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity adjustment (can be positive or negative) (数量调整(可以为正或负))
  reason: string; // Reason for adjustment (调整原因)
  createdBy: string; // ID of creator (创建人ID)
}

export interface IBalanceInfo {
  totalQuantity: number; // Total quantity (总数量)
  consumedQuantity: number; // Consumed quantity (已消费数量)
  heldQuantity: number; // Held quantity (预留数量)
  availableQuantity: number; // Available quantity (可用数量)
}

/**
 * Filter DTO for querying ledgers (v2.16.12 - 学生级权益累积制)
 *
 * @change {v2.16.12} Removed contractId - now queries by studentId + serviceType across all contracts
 */
export interface ILedgerFilterDto {
  studentId?: string; // Student ID (学生ID)
  serviceType?: string; // Service type (服务类型)
  startDate?: Date; // Filter start date (筛选开始日期)
  endDate?: Date; // Filter end date (筛选结束日期)
}

export interface ILedgerQueryOptions {
  includeArchive?: boolean; // Whether to include archived records (是否包含已归档记录)
  pagination?: { page: number; pageSize: number }; // Pagination parameters (分页参数)
}
