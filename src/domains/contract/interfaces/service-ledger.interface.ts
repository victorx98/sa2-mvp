/**
 * Service Ledger Service Interface
 */

import { ServiceLedger } from "@infrastructure/database/schema";
import { IPaginatedResult } from "./contract.interface";

export interface IServiceLedgerService {
  recordConsumption(dto: IRecordConsumptionDto): Promise<ServiceLedger>;
  recordAdjustment(dto: IRecordAdjustmentDto): Promise<ServiceLedger>;
  calculateAvailableBalance(
    contractId: string,
    serviceType: string,
  ): Promise<IBalanceInfo>;
  queryLedgers(
    filter: ILedgerFilterDto,
    options?: ILedgerQueryOptions,
  ): Promise<IPaginatedResult<ServiceLedger>>;
  reconcileBalance(contractId: string, serviceType: string): Promise<boolean>;
}

export interface IRecordConsumptionDto {
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity: number;
  sessionId?: string;
  createdBy: string;
}

export interface IRecordAdjustmentDto {
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity: number;
  reason: string;
  createdBy: string;
}

export interface IBalanceInfo {
  totalQuantity: number;
  consumedQuantity: number;
  heldQuantity: number;
  availableQuantity: number;
}

export interface ILedgerFilterDto {
  contractId?: string;
  studentId?: string;
  serviceType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ILedgerQueryOptions {
  includeArchive?: boolean;
  pagination?: { page: number; pageSize: number };
}
