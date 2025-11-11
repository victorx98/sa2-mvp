/**
 * Service Ledger Service Interface (服务台账服务接口)
 */

import { ServiceLedger } from "@infrastructure/database/schema";
import { IPaginatedResult } from "./contract.interface";

export interface IServiceLedgerService {
  recordConsumption(dto: IRecordConsumptionDto): Promise<ServiceLedger>; // Record consumption (记录消费)
  recordAdjustment(dto: IRecordAdjustmentDto): Promise<ServiceLedger>; // Record adjustment (记录调整)
  calculateAvailableBalance(
    contractId: string,
    serviceType: string,
  ): Promise<IBalanceInfo>; // Calculate available balance (计算可用余额)
  queryLedgers(
    filter: ILedgerFilterDto,
    options?: ILedgerQueryOptions,
  ): Promise<IPaginatedResult<ServiceLedger>>; // Query ledgers (查询台账)
  reconcileBalance(contractId: string, serviceType: string): Promise<boolean>; // Reconcile balance (对账)
}

export interface IRecordConsumptionDto {
  contractId: string; // Contract ID (合约ID)
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to consume (消费数量)
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))
  createdBy: string; // ID of creator (创建人ID)
}

export interface IRecordAdjustmentDto {
  contractId: string; // Contract ID (合约ID)
  studentId: string; // Student ID (学生ID)
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

export interface ILedgerFilterDto {
  contractId?: string; // Contract ID (合约ID)
  studentId?: string; // Student ID (学生ID)
  serviceType?: string; // Service type (服务类型)
  startDate?: Date; // Filter start date (筛选开始日期)
  endDate?: Date; // Filter end date (筛选结束日期)
}

export interface ILedgerQueryOptions {
  includeArchive?: boolean; // Whether to include archived records (是否包含已归档记录)
  pagination?: { page: number; pageSize: number }; // Pagination parameters (分页参数)
}
