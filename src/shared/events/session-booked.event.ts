import type { ServiceType } from "@domains/contract/common/types/enum.types";

export const SESSION_BOOKED_EVENT = "session.booked";

/**
 * Application-level Event - Session Booked
 * 事务提交后用于跨层通知（如发送提醒、同步外部系统）
 */
export interface SessionBookedEvent {
  sessionId: string;
  counselorId: string;
  studentId: string;
  mentorId: string;
  serviceType: ServiceType;
  calendarSlotId: string;
  serviceHoldId: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  duration: number;
  meetingProvider?: string;
  meetingPassword?: string;
  meetingUrl?: string;
}
