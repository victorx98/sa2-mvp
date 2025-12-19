import { IEvent } from "./event.types";

export const SERVICE_SESSION_COMPLETED_EVENT = "services.session.completed";

export interface IServiceSessionCompletedPayload {
  /**
   * Unique identifier for the session [会话的唯一标识符]
   */
  sessionId?: string;

  /**
   * Unique identifier for the student [学生的唯一标识符]
   */
  studentId: string;

  /**
   * Unique identifier for the mentor [导师的唯一标识符]
   */
  mentorId?: string;

  /**
   * Reference ID for the session [会话的参考ID]
   */
  refrenceId?: string;

  /**
   * Service type code (business-level service type) [Service type code (业务级别的服务类型)]
   */
  serviceTypeCode: string;

  /**
   * 实际会话持续时间（分钟）
   */
  actualDurationMinutes: number;

  /**
   * 预约持续时间（分钟）
   */
  durationMinutes: number;

  /**
   * 是否允许计费 [是否允许计费]
   */
  allowBilling: boolean;

  /**
   * Session type code (identifies the session type, e.g., ai_career, regular_mentoring) [会话类型代码（标识会话类型，例如：ai_career、regular_mentoring）]
   */
  sessionTypeCode: string;
}

export interface IServiceSessionCompletedEvent
  extends IEvent<IServiceSessionCompletedPayload> {
  type: typeof SERVICE_SESSION_COMPLETED_EVENT;
}
