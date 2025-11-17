export const SERVICE_SESSION_COMPLETED_EVENT = "services.session.completed";

export interface ServiceSessionCompletedEvent {
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
   * Type of service provided [提供的服务类型]
   */
  serviceType: string;

  /**
   * Duration of the session in hours [会话持续时间（小时）]
   */
  durationHours: number;
}
