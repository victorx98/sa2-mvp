// Event Types
export * from "./event.types";

// Event Constants (must be imported before other event files)
export * from "./event-constants";

// Settlement Events (export interfaces only, constants are in event-constants)
export type {
  ISettlementConfirmedPayload,
  ISettlementConfirmedEvent,
} from "./settlement-confirmed.event";

// Service Session Events
export type {
  IServiceSessionCompletedPayload,
  IServiceSessionCompletedEvent,
} from "./service-session-completed.event";

// Session Events
export type { SessionBookedEvent } from "./session-booked.event";
export type { SessionCreatedEvent } from "./session-created.event";

// Session type-specific created events (v2.0)
export type { RegularMentoringSessionCreatedEvent } from "./regular-mentoring-session-created.event";
export type { GapAnalysisSessionCreatedEvent } from "./gap-analysis-session-created.event";
export type { AiCareerSessionCreatedEvent } from "./ai-career-session-created.event";

// Meeting Events (v4.1)
export type {
  MeetingLifecycleCompletedPayload,
  MeetingLifecycleCompletedEvent,
  MeetingTimeSegment,
} from "./meeting-lifecycle-completed.event";
export type {
  MeetingRecordingReadyPayload,
  MeetingRecordingReadyEvent,
} from "./meeting-recording-ready.event";

// Placement Application Events
export {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
} from "./event-constants";
export type {
  IJobApplicationStatusChangedPayload,
  IJobApplicationStatusChangedEvent,
  IJobApplicationStatusRolledBackPayload,
  IJobApplicationStatusRolledBackEvent,
} from "./placement-application.events";
