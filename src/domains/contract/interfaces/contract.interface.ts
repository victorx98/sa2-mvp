/**
 * Contract Service Interface
 * Core interface for contract management
 */

import {
  Contract,
  ContractServiceEntitlement,
} from "@infrastructure/database/schema";
import { IProductSnapshot } from "../common/types/snapshot.types";

export interface IContractService {
  // Contract Management (9 methods)
  create(dto: ICreateContractDto): Promise<Contract>;
  search(
    filter: IContractFilterDto,
    pagination?: IPaginationDto,
    sort?: ISortDto,
  ): Promise<IPaginatedResult<Contract>>;
  findOne(filter: IFindOneContractDto): Promise<Contract | null>;
  update(id: string, dto: IUpdateContractDto): Promise<Contract>;
  activate(id: string): Promise<Contract>;
  terminate(id: string, reason: string): Promise<Contract>;
  complete(id: string): Promise<Contract>;
  suspend(id: string, reason: string): Promise<Contract>;
  resume(id: string): Promise<Contract>;

  // Service Entitlement Management (3 methods)
  getServiceBalance(query: IServiceBalanceQuery): Promise<IServiceBalance>;
  consumeService(dto: IConsumeServiceDto): Promise<void>;
  addEntitlement(dto: IAddEntitlementDto): Promise<ContractServiceEntitlement>;
}

// DTO placeholder types (to be defined in dto/ directory)
export interface ICreateContractDto {
  studentId: string;
  productId: string;
  productSnapshot: IProductSnapshot;
  signedAt?: Date;
  overrideAmount?: string;
  overrideReason?: string;
  overrideApprovedBy?: string;
  createdBy: string;
}

export interface IUpdateContractDto {
  overrideAmount?: string;
  overrideReason?: string;
  overrideApprovedBy?: string;
  suspendedAt?: Date;
  suspendedReason?: string;
  resumedAt?: Date;
  terminatedAt?: Date;
  terminatedReason?: string;
  completedAt?: Date;
  updatedBy?: string;
}

export interface IContractFilterDto {
  studentId?: string;
  status?: string;
  productId?: string;
}

export interface IFindOneContractDto {
  contractId?: string;
  contractNumber?: string;
  studentId?: string;
  status?: string;
}

export interface IPaginationDto {
  page: number;
  pageSize: number;
}

export interface ISortDto {
  field: string;
  order: "asc" | "desc";
}

export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IServiceBalanceQuery {
  contractId?: string;
  studentId?: string;
  serviceType?: string;
}

export interface IServiceBalance {
  serviceType: string;
  totalQuantity: number;
  consumedQuantity: number;
  heldQuantity: number;
  availableQuantity: number;
}

export interface IConsumeServiceDto {
  contractId: string;
  serviceType: string;
  quantity: number;
  sessionId?: string;
  createdBy: string;
}

export interface IAddEntitlementDto {
  contractId: string;
  serviceType: string;
  source: "addon" | "promotion" | "compensation";
  quantity: number;
  reason: string;
  createdBy: string;
}
