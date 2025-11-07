/**
 * Service Ledger Archive Service Interface
 */

import { ServiceLedgerArchivePolicy } from "@infrastructure/database/schema";

export interface IServiceLedgerArchiveService {
  archiveOldLedgers(daysOld?: number): Promise<IArchiveResult>;
  getArchivePolicy(
    contractId?: string,
    serviceType?: string,
  ): Promise<IArchivePolicy>;
  createPolicy(
    dto: ICreateArchivePolicyDto,
  ): Promise<ServiceLedgerArchivePolicy>;
  updatePolicy(
    id: string,
    dto: IUpdateArchivePolicyDto,
  ): Promise<ServiceLedgerArchivePolicy>;
}

export interface IArchiveResult {
  totalArchived: number;
  totalDeleted: number;
  archivedAt: Date;
  timeTaken: number;
}

export interface IArchivePolicy {
  archiveAfterDays: number;
  deleteAfterArchive: boolean;
}

export interface ICreateArchivePolicyDto {
  scope: "global" | "contract" | "service_type";
  contractId?: string;
  serviceType?: string;
  archiveAfterDays: number;
  deleteAfterArchive: boolean;
  createdBy: string;
  notes?: string;
}

export interface IUpdateArchivePolicyDto {
  archiveAfterDays?: number;
  deleteAfterArchive?: boolean;
  enabled?: boolean;
  notes?: string;
}
