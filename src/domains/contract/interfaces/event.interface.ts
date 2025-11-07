/**
 * Domain Event Service Interface
 */

import { DomainEvent } from "@infrastructure/database/schema";
import { DrizzleTransaction } from "@shared/types/database.types";

export interface IEventService {
  publishEvent(
    dto: IPublishEventDto,
    tx?: DrizzleTransaction,
  ): Promise<DomainEvent>;
  processPendingEvents(): Promise<number>;
  retryFailedEvents(): Promise<number>;
  cleanupOldEvents(retentionDays?: number): Promise<number>;
}

export interface IPublishEventDto {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    publishedBy?: string;
  };
}

// Event types
export const CONTRACT_EVENT_TYPES = {
  CONTRACT_SIGNED: "contract.signed",
  CONTRACT_ACTIVATED: "contract.activated",
  CONTRACT_SUSPENDED: "contract.suspended",
  CONTRACT_RESUMED: "contract.resumed",
  CONTRACT_COMPLETED: "contract.completed",
  CONTRACT_TERMINATED: "contract.terminated",
  ENTITLEMENT_ADDED: "entitlement.added",
  SERVICE_CONSUMED: "service.consumed",
} as const;
