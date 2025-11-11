/**
 * Service Ledger Archive Service Interface (服务台账归档服务接口)
 */

import { ServiceLedgerArchivePolicy } from "@infrastructure/database/schema";

export interface IServiceLedgerArchiveService {
  archiveOldLedgers(daysOld?: number): Promise<IArchiveResult>; // Archive old ledgers (归档旧台账)
  getArchivePolicy(
    contractId?: string,
    serviceType?: string,
  ): Promise<IArchivePolicy>; // Get archive policy (获取归档策略)
  createPolicy(
    dto: ICreateArchivePolicyDto,
  ): Promise<ServiceLedgerArchivePolicy>; // Create policy (创建策略)
  updatePolicy(
    id: string,
    dto: IUpdateArchivePolicyDto,
  ): Promise<ServiceLedgerArchivePolicy>; // Update policy (更新策略)
}

export interface IArchiveResult {
  totalArchived: number; // Total archived count (归档总数)
  totalDeleted: number; // Total deleted count (删除总数)
  archivedAt: Date; // Archive timestamp (归档时间戳)
  timeTaken: number; // Time taken in ms (耗时毫秒数)
}

export interface IArchivePolicy {
  archiveAfterDays: number; // Days after which to archive (归档后天数)
  deleteAfterArchive: boolean; // Whether to delete after archiving (归档后是否删除)
}

export interface ICreateArchivePolicyDto {
  scope: "global" | "contract" | "service_type"; // Policy scope (策略范围)
  contractId?: string; // Contract ID (合约ID)
  serviceType?: string; // Service type (服务类型)
  archiveAfterDays: number; // Days after which to archive (归档后天数)
  deleteAfterArchive: boolean; // Whether to delete after archiving (归档后是否删除)
  createdBy: string; // ID of creator (创建人ID)
  notes?: string; // Policy notes (策略备注)
}

export interface IUpdateArchivePolicyDto {
  archiveAfterDays?: number; // Days after which to archive (归档后天数)
  deleteAfterArchive?: boolean; // Whether to delete after archiving (归档后是否删除)
  enabled?: boolean; // Whether policy is enabled (策略是否启用)
  notes?: string; // Policy notes (策略备注)
}
