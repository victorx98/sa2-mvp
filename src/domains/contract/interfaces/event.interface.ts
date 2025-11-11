/**
 * Domain Event Service Interface (领域事件服务接口)
 */

import { DomainEvent } from "@infrastructure/database/schema";
import { DrizzleTransaction } from "@shared/types/database.types";

export interface IEventService {
  publishEvent(
    dto: IPublishEventDto,
    tx?: DrizzleTransaction,
  ): Promise<DomainEvent>; // Publish event (发布事件)
  processPendingEvents(): Promise<number>; // Process pending events (处理待处理事件)
  retryFailedEvents(): Promise<number>; // Retry failed events (重试失败事件)
  cleanupOldEvents(retentionDays?: number): Promise<number>; // Cleanup old events (清理旧事件)
}

export interface IPublishEventDto {
  eventType: string; // Event type (事件类型)
  aggregateId: string; // Aggregate root ID (聚合根ID)
  aggregateType: string; // Aggregate root type (聚合根类型)
  payload: Record<string, unknown>; // Event payload (事件负载)
  metadata?: {
    correlationId?: string; // Correlation ID (关联ID)
    causationId?: string; // Causation ID (原因ID)
    publishedBy?: string; // Publisher ID (发布人ID)
  };
}

// Event types (事件类型)
export const CONTRACT_EVENT_TYPES = {
  CONTRACT_SIGNED: "contract.signed", // Contract signed event (合约签署事件)
  CONTRACT_ACTIVATED: "contract.activated", // Contract activated event (合约激活事件)
  CONTRACT_SUSPENDED: "contract.suspended", // Contract suspended event (合约暂停事件)
  CONTRACT_RESUMED: "contract.resumed", // Contract resumed event (合约恢复事件)
  CONTRACT_COMPLETED: "contract.completed", // Contract completed event (合约完成事件)
  CONTRACT_TERMINATED: "contract.terminated", // Contract terminated event (合约终止事件)
  ENTITLEMENT_ADDED: "entitlement.added", // Entitlement added event (权益添加事件)
  SERVICE_CONSUMED: "service.consumed", // Service consumed event (服务消费事件)
} as const;
