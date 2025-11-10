/**
 * Service Hold Service Interface
 */

import { ServiceHold } from "@infrastructure/database/schema";
import { DrizzleTransaction } from "@shared/types/database.types";

export interface IServiceHoldService {
  createHold(
    dto: ICreateHoldDto,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold>;
  releaseHold(id: string, reason: string): Promise<ServiceHold>;
  /**
   * Get long-unreleased holds for manual review (v2.16.9)
   * - Returns holds created more than N hours ago that are still active
   * - No automatic expiration - manual review and release only
   * @param hoursOld - Threshold in hours (default: 24)
   */
  getLongUnreleasedHolds(
    hoursOld?: number,
    tx?: DrizzleTransaction,
  ): Promise<ServiceHold[]>;
  getActiveHolds(
    contractId: string,
    serviceType: string,
  ): Promise<ServiceHold[]>;
  cancelHold(id: string, reason: string): Promise<ServiceHold>;
}

export interface ICreateHoldDto {
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity: number;
  relatedBookingId?: string;
  createdBy: string;
}
