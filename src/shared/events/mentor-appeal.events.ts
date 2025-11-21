/**
 * Mentor Appeal Events (导师申诉事件)
 *
 * Defines domain events for mentor appeal lifecycle
 * (定义导师申诉生命周期的领域事件)
 */

import { IEvent } from "@shared/events/event.types";
import {
  MENTOR_APPEAL_CREATED_EVENT,
  MENTOR_APPEAL_APPROVED_EVENT,
  MENTOR_APPEAL_REJECTED_EVENT,
} from "@shared/events/event-constants";

/**
 * Payload for mentor appeal created event
 * 导师申诉创建事件载荷
 */
export interface IMentorAppealCreatedPayload {
  /**
   * Appeal ID (申诉ID)
   */
  appealId: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Counselor ID (处理顾问ID)
   */
  counselorId: string;

  /**
   * Appeal Amount (申诉金额)
   * Stored as string to match database numeric(12,2) type
   * (存储为字符串以匹配数据库numeric(12,2)类型)
   */
  appealAmount: string;

  /**
   * Appeal Type (申诉类型)
   */
  appealType: string;

  /**
   * Currency (货币类型)
   */
  currency: string;

  /**
   * Timestamp when the appeal was created
   * 申诉创建时间戳
   */
  createdAt: Date;
}

/**
 * Mentor Appeal Created Event
 * 导师申诉创建事件
 *
 * Published when a mentor submits a new appeal
 * 当导师提交新申诉时发布
 */
export interface IMentorAppealCreatedEvent
  extends IEvent<IMentorAppealCreatedPayload> {
  type: typeof MENTOR_APPEAL_CREATED_EVENT;
}

/**
 * Payload for mentor appeal approved event
 * 导师申诉批准事件载荷
 */
export interface IMentorAppealApprovedPayload {
  /**
   * Appeal ID (申诉ID)
   */
  appealId: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Counselor ID (处理顾问ID)
   */
  counselorId: string;

  /**
   * Appeal Amount (申诉金额)
   * Stored as string to match database numeric(12,2) type
   * (存储为字符串以匹配数据库numeric(12,2)类型)
   */
  appealAmount: string;

  /**
   * ID of the user who approved the appeal
   * 批准申诉的用户ID
   */
  approvedBy: string;

  /**
   * Timestamp when the appeal was approved
   * 申诉批准时间戳
   */
  approvedAt: Date;

  /**
   * Currency (货币类型)
   */
  currency: string;
}

/**
 * Mentor Appeal Approved Event
 * 导师申诉批准事件
 *
 * Published when a counselor approves an appeal
 * 当顾问批准申诉时发布
 */
export interface IMentorAppealApprovedEvent
  extends IEvent<IMentorAppealApprovedPayload> {
  type: typeof MENTOR_APPEAL_APPROVED_EVENT;
}

/**
 * Payload for mentor appeal rejected event
 * 导师申诉驳回事件载荷
 */
export interface IMentorAppealRejectedPayload {
  /**
   * Appeal ID (申诉ID)
   */
  appealId: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Counselor ID (处理顾问ID)
   */
  counselorId: string;

  /**
   * Rejection Reason (驳回理由)
   */
  rejectionReason: string;

  /**
   * ID of the user who rejected the appeal
   * 驳回申诉的用户ID
   */
  rejectedBy: string;

  /**
   * Timestamp when the appeal was rejected
   * 申诉驳回时间戳
   */
  rejectedAt: Date;
}

/**
 * Mentor Appeal Rejected Event
 * 导师申诉驳回事件
 *
 * Published when a counselor rejects an appeal
 * 当顾问驳回申诉时发布
 */
export interface IMentorAppealRejectedEvent
  extends IEvent<IMentorAppealRejectedPayload> {
  type: typeof MENTOR_APPEAL_REJECTED_EVENT;
}
