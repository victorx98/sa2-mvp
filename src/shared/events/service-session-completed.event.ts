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
   * Type code of session [会话类型代码]
   */
  sessionTypeCode: string;

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
   * Booking table name (database table name), provided directly by the domain publishing the event [预约表名（数据库表名），由发布事件的域直接传入]
   */
  bookingSource: string;
}

export interface IServiceSessionCompletedEvent
  extends IEvent<IServiceSessionCompletedPayload> {
  type: typeof SERVICE_SESSION_COMPLETED_EVENT;
}
