import type { ServiceType } from "@infrastructure/database/schema/service-types.schema";

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
  serviceType: string;
  mentorCalendarSlotId: string;
  studentCalendarSlotId: string;
  serviceHoldId: string;
  scheduledStartTime: string;
  duration: number;
  meetingProvider?: string;
  meetingPassword?: string;
  meetingUrl: string; // Must have a value when event is published (after async meeting creation completes)
}
