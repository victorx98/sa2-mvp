/**
 * Domain Event Constants
 * 领域事件常量
 *
 * Centralized event name constants for all domain events.
 * 所有领域事件的集中事件名称常量。
 */

// Session Events (会话事件)
export const SESSION_BOOKED_EVENT = "session.booked";
export const SESSION_CREATED_EVENT = "session.created";

// Service Session Events (服务会话事件)
export const SERVICE_SESSION_COMPLETED_EVENT = "services.session.completed";

// Meeting Events (会议事件) - v4.1
export const MEETING_LIFECYCLE_COMPLETED_EVENT = "meeting.lifecycle.completed";
export const MEETING_RECORDING_READY_EVENT = "meeting.recording.ready";

// Financial Events (财务事件)
export const SETTLEMENT_CONFIRMED_EVENT = "financial.settlement.confirmed";

// Appeal Events (申诉事件)
export const MENTOR_APPEAL_CREATED_EVENT = "financial.appeal.created";
export const MENTOR_APPEAL_APPROVED_EVENT = "financial.appeal.approved";
export const MENTOR_APPEAL_REJECTED_EVENT = "financial.appeal.rejected";
