/**
 * Service Ledger Service Interface
 */

import { ServiceLedger } from "@infrastructure/database/schema";
import { IPaginatedResult } from "./contract.interface";

/**
 * Service Ledger Service Interface
 */
export interface IServiceLedgerService {
  recordConsumption(dto: IRecordConsumptionDto): Promise<ServiceLedger>; // Record consumption (记录消费)
  recordRefund(dto: IRecordRefundDto): Promise<ServiceLedger>; // Record refund (记录退款)
  recordAdjustment(dto: IRecordAdjustmentDto): Promise<ServiceLedger>; // Record adjustment (记录调整)
  calculateAvailableBalance(
    studentId: string,
    serviceType: string,
  ): Promise<IBalanceInfo>; // Calculate available balance (计算可用余额)
  queryLedgers(
    filter: ILedgerFilterDto,
    options?: ILedgerQueryOptions,
  ): Promise<IPaginatedResult<ServiceLedger>>; // Query ledgers (查询台账)
  reconcileBalance(studentId: string, serviceType: string): Promise<boolean>; // Reconcile balance (对账)
}

/**
 * DTO for recording service consumption
 */
export interface IRecordConsumptionDto {
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to consume (消费数量)
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))
  bookingSource?: string; // Booking table name (e.g., 'regular_mentoring_sessions', 'job_applications') - required when relatedBookingId is provided [预约表名（如'regular_mentoring_sessions'、'job_applications'）- 当relatedBookingId存在时必填]
  createdBy: string; // ID of creator (创建人ID)
}

/**
 * DTO for recording manual adjustment
 */
export interface IRecordAdjustmentDto {
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity adjustment (can be positive or negative) (数量调整(可以为正或负))
  reason: string; // Reason for adjustment (调整原因)
  createdBy: string; // ID of creator (创建人ID)
}

/**
 * DTO for recording service refund
 */
export interface IRecordRefundDto {
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to refund (must be positive) (退还数量(必须为正数))
  relatedBookingId: string; // Associated booking ID (关联预约ID)
  bookingSource: string; // Booking table name (e.g., 'resumes') (预约表名（如'resumes'）)
  createdBy: string; // ID of creator (创建人ID)
}

export interface IBalanceInfo {
  totalQuantity: number; // Total quantity (总数量)
  consumedQuantity: number; // Consumed quantity (已消费数量)
  heldQuantity: number; // Held quantity (预留数量)
  availableQuantity: number; // Available quantity (可用数量)
}

/**
 * Filter DTO for querying ledgers
 */
export interface ILedgerFilterDto {
  studentId?: string; // Student ID (学生ID)
  serviceType?: string; // Service type (服务类型)
  startDate?: Date; // Filter start date (筛选开始日期)
  endDate?: Date; // Filter end date (筛选结束日期)
}

export interface ILedgerQueryOptions {
  pagination?: { page: number; pageSize: number }; // Pagination parameters (分页参数)
}
