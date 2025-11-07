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
  expireHolds(): Promise<number>;
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
