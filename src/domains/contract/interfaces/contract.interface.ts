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
  getServiceBalance(query: IServiceBalanceQuery): Promise<IServiceBalance>;
  consumeService(dto: IConsumeServiceDto): Promise<void>;
  addEntitlement(dto: IAddEntitlementDto): Promise<ContractServiceEntitlement>;
}

// DTO placeholder types (to be defined in dto/ directory) (DTO占位符类型(在dto/目录中定义))
export interface ICreateContractDto {
  studentId: string; // Student ID (学生ID)
  productId: string; // Product ID (产品ID)
  productSnapshot: IProductSnapshot; // Product snapshot (产品快照)
  signedAt?: Date; // Contract signing date (合约签署日期)
  overrideAmount?: string; // Price override amount (价格覆盖金额)
  overrideReason?: string; // Reason for price override (价格覆盖原因)
  overrideApprovedBy?: string; // Approver of price override (价格覆盖批准人)
  createdBy: string; // ID of creator (创建人ID)
  title?: string; // Contract title (合约标题)
}

export interface IUpdateContractDto {
  overrideAmount?: string; // Price override amount (价格覆盖金额)
  overrideReason?: string; // Reason for price override (价格覆盖原因)
  overrideApprovedBy?: string; // Approver of price override (价格覆盖批准人)
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
  contractId?: string; // Contract ID (合约ID)
  studentId?: string; // Student ID (学生ID)
  serviceType?: string; // Service type (服务类型)
  includeExpired?: boolean; // Whether to include expired entitlements (是否包含过期的权益)
}

export interface IServiceBalance {
  query: {
    contractId?: string; // Contract ID (合约ID)
    studentId?: string; // Student ID (学生ID)
    serviceType?: string; // Service type (服务类型)
  };
  student?: {
    id: string; // Student ID (学生ID)
    name?: string; // Student name (学生姓名)
    email?: string; // Student email (学生邮箱)
  };
  contracts: Array<{
    contractId: string; // Contract ID (合约ID)
    contractNumber: string; // Contract number (合约编号)
    contractTitle?: string; // Contract title (合约标题)
    contractStatus: string; // Contract status (合约状态)
    studentId: string; // Student ID (学生ID)
    signedAt?: Date; // Contract signing date (合约签署日期)
    expiresAt?: Date; // Contract expiration date (合约到期日期)
    isExpired: boolean; // Whether contract is expired (合约是否已过期)
    entitlements: Array<{
      serviceType: string; // Service type (服务类型)
      serviceName: string; // Service name (服务名称)
      totalQuantity: number; // Total quantity (总数量)
      consumedQuantity: number; // Consumed quantity (已消费数量)
      heldQuantity: number; // Held quantity (预留数量)
      availableQuantity: number; // Available quantity (可用数量)
      expiresAt?: Date; // Expiration date (到期日期)
      isExpired: boolean; // Whether entitlement is expired (权益是否已过期)
    }>;
  }>;
}

export interface IConsumeServiceDto {
  contractId: string; // Contract ID (合约ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to consume (消费数量)
  relatedBookingId?: string; // Associated booking ID (generic field for session, class, mock_interview, etc.) (关联预约ID(通用字段，适用于session、class、mock_interview等))
  createdBy: string; // ID of creator (创建人ID)
}

export interface IAddEntitlementDto {
  contractId: string; // Contract ID (合约ID)
  serviceType: string; // Service type (服务类型)
  source: "addon" | "promotion" | "compensation"; // Source type (来源类型)
  quantity: number; // Quantity of service entitlement (服务权益数量)
  reason: string; // Reason for adding entitlement (添加权益的原因)
  createdBy: string; // ID of creator (创建人ID)
}
