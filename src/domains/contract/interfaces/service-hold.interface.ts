/**
 * Service Hold Service Interface (服务预留服务接口)
 */

import { ServiceHold } from "@infrastructure/database/schema";
import { DrizzleTransaction } from "@shared/types/database.types";

export interface IServiceHoldService {
  createHold(
    dto: ICreateHoldDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold>; // Create hold (创建预留)
  releaseHold(id: string, reason: string): Promise<ServiceHold>; // Release hold (释放预留)
  /**
   * Get long-unreleased holds for manual review (v2.16.9) (获取长时间未释放的预留用于人工审核(v2.16.9))
   * - Returns holds created more than N hours ago that are still active (返回超过N小时前创建且仍处于活动状态的预留)
   * - No automatic expiration - manual review and release only (不会自动过期 - 仅限人工审核和释放)
   * @param hoursOld - Threshold in hours (default: 24) (小时数阈值(默认: 24))
   */
  getLongUnreleasedHolds(
    hoursOld?: number,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold[]>; // Get long-unreleased holds (获取长时间未释放的预留)
  getActiveHolds(
    contractId: string,
    serviceType: string,
  ): Promise<ServiceHold[]>; // Get active holds (获取活动预留)
  cancelHold(id: string, reason: string): Promise<ServiceHold>; // Cancel hold (取消预留)
}

export interface ICreateHoldDto {
  contractId: string; // Contract ID (合约ID)
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
  quantity: number; // Quantity to hold (预留数量)
  relatedBookingId?: string; // Associated booking ID (关联预约ID)
  createdBy: string; // ID of creator (创建人ID)
}
