/**
 * Contract Service Interface (合约服务接口)
 * Core interface for contract management (合约管理的核心接口)
 */

import {
  Contract,
  ContractServiceEntitlement,
} from "@infrastructure/database/schema";
import { IProductSnapshot } from "../common/types/snapshot.types";
import {
  AmendmentLedgerType,
  ContractStatus,
} from "@shared/types/contract-enums";

export interface IContractService {
  // Contract Management (合约管理)
  create(dto: ICreateContractDto): Promise<Contract>;
  search(
    filter: IContractFilterDto,
    pagination?: IPaginationDto,
    sort?: ISortDto,
  ): Promise<IPaginatedResult<Contract>>;
  findOne(filter: IFindOneContractDto): Promise<Contract | null>;
  update(
    id: string,
    dto: IUpdateContractDto,
    updatedBy?: string,
  ): Promise<Contract>;
  updateStatus(
    id: string,
    targetStatus: ContractStatus,
    options?: {
      reason?: string;
      signedBy?: string;
    },
  ): Promise<Contract>;

  // Service Entitlement Management (3 methods) (服务权益管理(3个方法))
  getServiceBalance(query: IServiceBalanceQuery): Promise<IServiceBalance[]>;
  consumeService(dto: IConsumeServiceDto): Promise<void>;
  addAmendmentLedger(
    dto: IAddAmendmentLedgerDto,
  ): Promise<ContractServiceEntitlement>;
}

// DTO placeholder types (to be defined in dto/ directory) (DTO占位符类型(在dto/目录中定义))
export interface ICreateContractDto {
  studentId: string; // Student ID (学生ID)
  productId: string; // Product ID (产品ID)
  productSnapshot: IProductSnapshot; // Product snapshot (产品快照)
  status?: string; // Initial contract status, defaults to DRAFT (初始合同状态，默认为DRAFT)
  createdBy: string; // ID of creator (创建人ID)
  title?: string; // Contract title (合约标题)
}

export interface IUpdateContractDto {
  // Lifecycle date fields removed - now tracked in status history table
  // [生命周期日期字段已移除 - 现在在状态历史表中跟踪]
  updatedBy?: string; // Updater ID (更新人ID)
}

export interface IContractFilterDto {
  studentId?: string; // Student ID (学生ID)
  status?: string; // Contract status (合约状态)
  productId?: string; // Product ID (产品ID)
  signedAfter?: Date; // Signed after date (签署后日期)
  signedBefore?: Date; // Signed before date (签署前日期)
  expiresAfter?: Date; // Expires after date (到期后日期)
  expiresBefore?: Date; // Expires before date (到期前日期)
}

export interface IFindOneContractDto {
  contractId?: string; // Contract ID (合约ID)
  contractNumber?: string; // Contract number (合约编号)
  studentId?: string; // Student ID (学生ID)
  status?: string; // Contract status (合约状态)
  productId?: string; // Product ID (产品ID)
}

export interface IPaginationDto {
  page: number; // Page number (页码)
  pageSize: number; // Items per page (每页条目数)
}

export interface ISortDto {
  field: string; // Field to sort by (排序字段)
  order: "asc" | "desc"; // Sort order (排序顺序)
}

export interface IPaginatedResult<T> {
  data: T[]; // Data array (数据数组)
  total: number; // Total count (总数)
  page: number; // Current page (当前页)
  pageSize: number; // Page size (页面大小)
}

export interface IServiceBalanceQuery {
  studentId: string; // Student ID (学生ID) - Required parameter
  serviceType?: string; // Service type (服务类型) - Optional filter
}

export interface IServiceBalance {
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
  totalQuantity: number; // Total quantity (总数量)
  consumedQuantity: number; // Consumed quantity (已消费数量)
  heldQuantity: number; // Held quantity (预留数量)
  availableQuantity: number; // Available quantity (可用数量)
}

export interface IConsumeServiceDto {
  contractId: string; // Contract ID (合约ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to consume (消费数量)
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))
  createdBy: string; // ID of creator (创建人ID)
}

export interface IAddAmendmentLedgerDto {
  studentId: string; // Student ID (学生ID)
  contractId?: string; // Contract ID (optional for reference) (合约ID - 仅作参考，可选)
  serviceType: string; // Service type (服务类型)
  ledgerType: AmendmentLedgerType; // Ledger type (账本类型)
  quantityChanged: number; // Quantity changed (变更数量)
  reason: string; // Reason for amendment (调整原因)
  description?: string; // Optional detailed description (可选详细说明)
  attachments?: string[]; // Optional array of attachment URLs (可选附件URL数组)
  relatedBookingId?: string; // Associated booking ID (关联预约ID)
  createdBy: string; // ID of creator (创建人ID)
}
