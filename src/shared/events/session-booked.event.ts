export const SESSION_BOOKED_EVENT = "services.session.booked";

/**
 * Application-level Event - Session Booked
 * 事务提交后用于跨层通知（如发送提醒、同步外部系统）
 */
export interface SessionBookedEvent {
  sessionId: string;
  counselorId: string;
  studentId: string;
  mentorId: string;
  serviceType: string; // 服务类型代码，如"session", "mock_interview"
  calendarSlotId: string;
  serviceHoldId: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  duration: number;
  meetingProvider?: string;
  meetingPassword?: string;
  meetingUrl?: string;
}
