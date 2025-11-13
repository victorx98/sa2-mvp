/**
 * Contract Service Interface (合约服务接口)
 * Core interface for contract management (合约管理的核心接口)
 */

import {
  Contract,
  ContractServiceEntitlement,
} from "@infrastructure/database/schema";
import { IProductSnapshot } from "../common/types/snapshot.types";

export interface IContractService {
  // Contract Management (9 methods) (合约管理(9个方法))
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
  activate(id: string): Promise<Contract>;
  terminate(id: string, reason: string): Promise<Contract>;
  complete(id: string): Promise<Contract>;
  suspend(id: string, reason: string): Promise<Contract>;
  resume(id: string): Promise<Contract>;

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
  signedAt?: Date; // Contract signing date (合约签署日期)
  createdBy: string; // ID of creator (创建人ID)
  title?: string; // Contract title (合约标题)
}

export interface IUpdateContractDto {
  suspendedAt?: Date; // Contract suspension date (合约暂停日期)
  suspendedReason?: string; // Reason for suspension (暂停原因)
  resumedAt?: Date; // Contract resumption date (合约恢复日期)
  terminatedAt?: Date; // Contract termination date (合约终止日期)
  terminatedReason?: string; // Reason for termination (终止原因)
  completedAt?: Date; // Contract completion date (合约完成日期)
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
  studentId: string; // Student ID (学生ID) - NEW in v2.16.12
  contractId?: string; // Contract ID (optional for reference) (合约ID - 仅作参考，可选)
  serviceType: string; // Service type (服务类型)
  ledgerType: "addon" | "promotion" | "compensation"; // Renamed from source (v2.16.12) - 从source重命名
  quantityChanged: number; // Renamed from quantity (v2.16.12) - 从quantity重命名
  reason: string; // Renamed from addOnReason (v2.16.12) - 从addOnReason重命名
  description?: string; // Optional detailed description (可选详细说明)
  attachments?: string[]; // Optional array of attachment URLs (可选附件URL数组)
  relatedBookingId?: string; // Associated booking ID (关联预约ID)
  createdBy: string; // ID of creator (创建人ID)
}
