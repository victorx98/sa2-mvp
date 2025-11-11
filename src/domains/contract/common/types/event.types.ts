import type { ServiceType } from "./enum.types";

/**
 * Base Event Interface (基础事件接口)
 * 所有事件都应继承此接口
 */
export interface IBaseEvent {
  id: string;
  eventType: string;
  timestamp: Date;
  payload: unknown;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    [key: string]: unknown;
  };
}

/**
 * Session Completed Event (会话完成事件)
 */
export interface ISessionCompletedEvent extends IBaseEvent {
  eventType: "session.completed";
  payload: {
    sessionId?: string;
    contractId: string;
    studentId: string;
    serviceType: ServiceType;
    holdId?: string;
    bookedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    durationMinutes?: number;
    // createdBy is provided by upstream system (e.g., mentorId, 'system', etc.)
    createdBy?: string;
  };
}

/**
 * Session Created Event (会话已创建事件)
 */
export interface ISessionCreatedEventData {
  sessionId: string;
  holdId: string;
  contractId: string;
  studentId: string;
  mentorId: string;
  serviceType: ServiceType;
  bookedAt: Date;
}

/**
 * Session Cancelled Event (会话取消事件)
 */
export interface ISessionCancelledEvent extends IBaseEvent {
  eventType: "session.cancelled";
  payload: {
    sessionId: string; // 必填：取消的会话ID
    holdId?: string; // 可选：关联的预留ID（如果未提供，需从DB查询）
    cancelledBy: string; // 必填：取消操作的发起者
    cancelledAt?: Date; // 可选
    reason?: string; // 可选
  };
}

/**
 * Payment Succeeded Event (支付成功事件)
 */
export interface IPaymentSucceededEvent extends IBaseEvent {
  eventType: "payment.succeeded";
  payload: {
    paymentId: string;
    contractId: string;
    studentId: string;
    amount: string;
    currency: string;
    paymentMethod: string;
    paidAt: Date;
    stripePaymentIntentId?: string;
  };
}

/**
 * Contract Activated Event (合同激活事件)
 */
export interface IContractActivatedEvent extends IBaseEvent {
  eventType: "contract.activated";
  payload: {
    contractId: string;
    contractNumber: string;
    studentId: string;
    productId: string;
    totalAmount: string;
    currency: string;
    activatedAt: Date;
  };
}

/**
 * Generic Domain Event (通用领域事件)
 * 用于事件发布器接口
 */
export interface IDomainEventData {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    [key: string]: unknown;
  };
}
