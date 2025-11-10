import { Injectable } from "@nestjs/common";
import type { DrizzleTransaction } from "@shared/types/database.types";

export interface IServiceBalanceMock {
  contractId: string;
  serviceId: string;
  total: number;
  used: number;
  held: number;
  available: number;
}

export interface ICreateServiceHoldInput {
  contractId: string;
  serviceId: string;
  sessionId: string;
  quantity: number;
}

export interface IServiceHoldMock {
  id: string;
  contractId: string;
  serviceId: string;
  sessionId: string;
  quantity: number;
  createdAt: Date;
}

@Injectable()
export class ContractService {
  async getServiceBalance(
    contractId: string,
    serviceId: string,
  ): Promise<IServiceBalanceMock> {
    return {
      contractId,
      serviceId,
      total: 10,
      used: 2,
      held: 1,
      available: 7,
    };
  }

  async createServiceHold(
    input: ICreateServiceHoldInput,
    _tx?: DrizzleTransaction,
  ): Promise<IServiceHoldMock> {
    const now = new Date();
    return {
      id: "mock-hold-id",
      contractId: input.contractId,
      serviceId: input.serviceId,
      sessionId: input.sessionId,
      quantity: input.quantity,
      createdAt: now,
    };
  }
}

