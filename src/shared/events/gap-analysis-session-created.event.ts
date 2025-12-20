import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  GAP_ANALYSIS_SESSION_CANCELLED_EVENT,
  GAP_ANALYSIS_SESSION_CREATED_EVENT,
  GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  GAP_ANALYSIS_SESSION_UPDATED_EVENT,
} from "./event-constants";

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const GapAnalysisSessionCreatedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  counselorId: z.string().min(1),
  scheduledStartTime: z.string().datetime(),
  duration: z.number().int().positive(),
  meetingProvider: z.string().min(1),
  topic: z.string().min(1),
  mentorCalendarSlotId: z.string().min(1),
  studentCalendarSlotId: z.string().min(1),
});

export type GapAnalysisSessionCreatedPayload = z.infer<
  typeof GapAnalysisSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: GAP_ANALYSIS_SESSION_CREATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after gap analysis session is created (async meeting creation trigger)",
})
export class GapAnalysisSessionCreatedEvent
  implements IEvent<GapAnalysisSessionCreatedPayload>
{
  static readonly eventType = GAP_ANALYSIS_SESSION_CREATED_EVENT;
  static readonly schema = GapAnalysisSessionCreatedPayloadSchema;

  readonly type = GapAnalysisSessionCreatedEvent.eventType;

  constructor(
    public readonly payload: GapAnalysisSessionCreatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const GapAnalysisSessionUpdatedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
  oldScheduledAt: DateTimeSchema.optional(),
  newScheduledAt: DateTimeSchema,
  oldDuration: z.number().int().positive(),
  newDuration: z.number().int().positive(),
  newTitle: z.string().min(1),
  mentorId: z.string().min(1),
  studentId: z.string().min(1),
  counselorId: z.string().min(1).optional(),
  meetingProvider: z.string().min(1),
});

export type GapAnalysisSessionUpdatedPayload = z.infer<
  typeof GapAnalysisSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: GAP_ANALYSIS_SESSION_UPDATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after gap analysis session is rescheduled (async meeting update trigger)",
})
export class GapAnalysisSessionUpdatedEvent
  implements IEvent<GapAnalysisSessionUpdatedPayload>
{
  static readonly eventType = GAP_ANALYSIS_SESSION_UPDATED_EVENT;
  static readonly schema = GapAnalysisSessionUpdatedPayloadSchema;

  readonly type = GapAnalysisSessionUpdatedEvent.eventType;

  constructor(
    public readonly payload: GapAnalysisSessionUpdatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const GapAnalysisSessionCancelledPayloadSchema = z.object({
  sessionId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  counselorId: z.string().min(1).optional(),
  scheduledAt: DateTimeSchema.optional(),
  cancelReason: z.string().min(1).optional(),
  cancelledAt: DateTimeSchema.optional(),
  meetingProvider: z.string().min(1).optional(),
});

export type GapAnalysisSessionCancelledPayload = z.infer<
  typeof GapAnalysisSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: GAP_ANALYSIS_SESSION_CANCELLED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after gap analysis session is cancelled (async meeting cancellation trigger)",
})
export class GapAnalysisSessionCancelledEvent
  implements IEvent<GapAnalysisSessionCancelledPayload>
{
  static readonly eventType = GAP_ANALYSIS_SESSION_CANCELLED_EVENT;
  static readonly schema = GapAnalysisSessionCancelledPayloadSchema;

  readonly type = GapAnalysisSessionCancelledEvent.eventType;

  constructor(
    public readonly payload: GapAnalysisSessionCancelledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const GapAnalysisSessionMeetingOperationResultPayloadSchema = z
  .object({
    operation: z.enum(["create", "update", "cancel"]),
    status: z.enum(["success", "failed"]),
    sessionId: z.string().min(1),
  })
  .passthrough();

export type GapAnalysisSessionMeetingOperationResultPayload = z.infer<
  typeof GapAnalysisSessionMeetingOperationResultPayloadSchema
>;

@IntegrationEvent({
  type: GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted when gap analysis async meeting operation completes (success/failed)",
})
export class GapAnalysisSessionMeetingOperationResultEvent
  implements IEvent<GapAnalysisSessionMeetingOperationResultPayload>
{
  static readonly eventType = GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT;
  static readonly schema = GapAnalysisSessionMeetingOperationResultPayloadSchema;

  readonly type = GapAnalysisSessionMeetingOperationResultEvent.eventType;

  constructor(
    public readonly payload: GapAnalysisSessionMeetingOperationResultPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

