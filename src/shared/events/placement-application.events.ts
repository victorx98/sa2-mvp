/**
 * Placement Application Events (投递申请事件)
 *
 * Defines domain events for job application lifecycle management
 * (定义投递申请生命周期管理的领域事件)
 */

import { IEvent } from "./event.types";
import { ApplicationStatus } from "@domains/placement/types/application-status.types";
import {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  PLACEMENT_APPLICATION_SUBMITTED_EVENT,
} from "./event-constants";

/**
 * Payload for job application status changed event
 * 投递状态变更事件载荷
 *
 * Contains information about a job application status transition
 * 包含投递申请状态转换的信息
 */
export interface IJobApplicationStatusChangedPayload {
  /**
   * Unique application identifier (投递申请唯一标识)
   */
  applicationId: string;

  /**
   * Previous status of the application before the change
   * 变更前的申请状态
   */
  previousStatus: ApplicationStatus;

  /**
   * New status of the application after the change
   * 变更后的申请状态
   */
  newStatus: ApplicationStatus;

  /**
   * ID of the user who initiated the status change (optional)
   * 发起状态变更的用户ID (可选)
   */
  changedBy?: string;

  /**
   * ISO timestamp when the status change occurred
   * 状态变更发生的ISO时间戳
   */
  changedAt: string;
}

/**
 * Job Application Status Changed Event
 * 投递状态变更事件
 *
 * Published when a job application status transitions to a new state
 * 当投递申请状态转换为新状态时发布
 */
export interface IJobApplicationStatusChangedEvent
  extends IEvent<IJobApplicationStatusChangedPayload> {
  /**
   * Event type constant
   */
  type: typeof JOB_APPLICATION_STATUS_CHANGED_EVENT;
}

/**
 * Payload for job application status rolled back event
 * 投递状态回撤事件载荷
 *
 * Contains information about a job application status rollback operation
 * 包含投递申请状态回撤操作的信息
 */
export interface IJobApplicationStatusRolledBackPayload {
  /**
   * Unique application identifier (投递申请唯一标识)
   */
  applicationId: string;

  /**
   * Previous status before the rollback (rollback from this status)
   * 回撤前的状态 (从该状态回撤)
   */
  previousStatus: ApplicationStatus;

  /**
   * New status after the rollback (rollback to this status)
   * 回撤后的状态 (回撤到该状态)
   */
  newStatus: ApplicationStatus;

  /**
   * ID of the user who initiated the rollback
   * 发起回撤的用户ID
   */
  changedBy: string;

  /**
   * ISO timestamp when the rollback occurred
   * 回撤发生的ISO时间戳
   */
  changedAt: string;

  /**
   * Reason for the status rollback
   * 状态回撤的原因
   */
  rollbackReason: string;
}

/**
 * Job Application Status Rolled Back Event
 * 投递状态回撤事件
 *
 * Published when a job application status is rolled back to a previous state
 * 当投递申请状态回撤到上一个状态时发布
 */
export interface IJobApplicationStatusRolledBackEvent
  extends IEvent<IJobApplicationStatusRolledBackPayload> {
  /**
   * Event type constant
   */
  type: typeof JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT;
}

/**
 * Payload for placement application submitted integration event
 * 投递申请提交（集成事件）载荷
 *
 * This payload must be sufficient for Service Registry registration without querying Placement tables
 * 该载荷需满足 Service Registry 登记需要，避免 Services 域反查 Placement 表
 */
export interface IPlacementApplicationSubmittedPayload {
  /**
   * Shared primary key (job_applications.id == service_references.id)
   * 共享主键（job_applications.id == service_references.id）
   */
  id: string;

  /**
   * Service type for Service Registry
   * Service Registry 的服务类型
   */
  service_type: "job_application";

  /**
   * Student user ID
   * 学生用户ID
   */
  student_user_id: string;

  /**
   * Provider user ID (mentor/counselor/operator)
   * 服务提供者用户ID（导师/顾问/操作者）
   */
  provider_user_id: string;

  /**
   * Consumed units (fixed to 1 for job application)
   * 消耗单位数量（投递固定为 1）
   */
  consumed_units: 1;

  /**
   * Unit type (fixed to count for job application)
   * 单位类型（投递固定为 count）
   */
  unit_type: "count";

  /**
   * Completed/submitted time
   * 完成/提交时间
   */
  completed_time: Date;

  /**
   * Human-readable title for reconciliation (optional)
   * 对账用标题（可选）
   */
  title?: string;
}

/**
 * Placement Application Submitted Event
 * 投递申请提交事件
 */
export interface IPlacementApplicationSubmittedEvent
  extends IEvent<IPlacementApplicationSubmittedPayload> {
  /**
   * Event type constant
   * 事件类型常量
   */
  type: typeof PLACEMENT_APPLICATION_SUBMITTED_EVENT;
}
