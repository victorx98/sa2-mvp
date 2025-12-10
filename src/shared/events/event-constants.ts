/**
 * Domain Event Constants
 * 领域事件常量
 *
 * Centralized event name constants for all domain events.
 * 所有领域事件的集中事件名称常量。
 */

// Session Events (会话事件)
export const SESSION_BOOKED_EVENT = "session.booked";
export const SESSION_CREATED_EVENT = "session.created"; // Legacy - 遗留事件，用于 Contract Domain

// Session Type-specific Created Events (会话类型特定创建事件 - v2.0)
// Trigger events (3 events for clear business semantics)
export const REGULAR_MENTORING_SESSION_CREATED_EVENT = "regular_mentoring.session.created";
export const REGULAR_MENTORING_SESSION_UPDATED_EVENT = "regular_mentoring.session.updated";
export const REGULAR_MENTORING_SESSION_CANCELLED_EVENT = "regular_mentoring.session.cancelled";

// Result event (1 unified event with operation + status fields)
export const REGULAR_MENTORING_SESSION_OPERATION_RESULT_EVENT = "regular_mentoring.session.operation.result";

// Gap Analysis Session Events
export const GAP_ANALYSIS_SESSION_CREATED_EVENT = "gap_analysis.session.created";
export const GAP_ANALYSIS_SESSION_UPDATED_EVENT = "gap_analysis.session.updated";
export const GAP_ANALYSIS_SESSION_CANCELLED_EVENT = "gap_analysis.session.cancelled";
export const GAP_ANALYSIS_SESSION_OPERATION_RESULT_EVENT = "gap_analysis.session.operation.result";

// AI Career Session Events
export const AI_CAREER_SESSION_CREATED_EVENT = "ai_career.session.created";
export const AI_CAREER_SESSION_UPDATED_EVENT = "ai_career.session.updated";
export const AI_CAREER_SESSION_CANCELLED_EVENT = "ai_career.session.cancelled";
export const AI_CAREER_SESSION_OPERATION_RESULT_EVENT = "ai_career.session.operation.result";

// Communication Session Events
export const COMM_SESSION_CREATED_EVENT = "comm_session.session.created";
export const COMM_SESSION_UPDATED_EVENT = "comm_session.session.updated";
export const COMM_SESSION_CANCELLED_EVENT = "comm_session.session.cancelled";
export const COMM_SESSION_OPERATION_RESULT_EVENT = "comm_session.session.operation.result";

// Legacy events (for backward compatibility)
export const SESSION_RESCHEDULED_COMPLETED = "session.rescheduled.completed";
export const CLASS_SESSION_CREATED_EVENT = "class_session.created";

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

// Placement Application Events (投递申请事件)
export const JOB_APPLICATION_STATUS_CHANGED_EVENT = "placement.application.status_changed";
export const JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT = "placement.application.status_rolled_back";
