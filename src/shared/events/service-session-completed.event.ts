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
   * Type of session [会话类型]
   */
  sessionType: string;

  /**
   * Duration of the session in hours [会话持续时间（小时）]
   */
  durationHours: number;
}

export interface IServiceSessionCompletedEvent extends IEvent<IServiceSessionCompletedPayload> {
  type: typeof SERVICE_SESSION_COMPLETED_EVENT;
}