import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  AI_CAREER_SESSION_CANCELLED_EVENT,
  AI_CAREER_SESSION_CREATED_EVENT,
  AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
  AI_CAREER_SESSION_UPDATED_EVENT,
} from "./event-constants";

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const AiCareerSessionCreatedPayloadSchema = z.object({
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

export type AiCareerSessionCreatedPayload = z.infer<
  typeof AiCareerSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: AI_CAREER_SESSION_CREATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after AI career session is created (async meeting creation trigger)",
})
export class AiCareerSessionCreatedEvent
  implements IEvent<AiCareerSessionCreatedPayload>
{
  static readonly eventType = AI_CAREER_SESSION_CREATED_EVENT;
  static readonly schema = AiCareerSessionCreatedPayloadSchema;

  readonly type = AiCareerSessionCreatedEvent.eventType;

  constructor(
    public readonly payload: AiCareerSessionCreatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const AiCareerSessionUpdatedPayloadSchema = z.object({
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

export type AiCareerSessionUpdatedPayload = z.infer<
  typeof AiCareerSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: AI_CAREER_SESSION_UPDATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after AI career session is rescheduled (async meeting update trigger)",
})
export class AiCareerSessionUpdatedEvent
  implements IEvent<AiCareerSessionUpdatedPayload>
{
  static readonly eventType = AI_CAREER_SESSION_UPDATED_EVENT;
  static readonly schema = AiCareerSessionUpdatedPayloadSchema;

  readonly type = AiCareerSessionUpdatedEvent.eventType;

  constructor(
    public readonly payload: AiCareerSessionUpdatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const AiCareerSessionCancelledPayloadSchema = z.object({
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

export type AiCareerSessionCancelledPayload = z.infer<
  typeof AiCareerSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: AI_CAREER_SESSION_CANCELLED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after AI career session is cancelled (async meeting cancellation trigger)",
})
export class AiCareerSessionCancelledEvent
  implements IEvent<AiCareerSessionCancelledPayload>
{
  static readonly eventType = AI_CAREER_SESSION_CANCELLED_EVENT;
  static readonly schema = AiCareerSessionCancelledPayloadSchema;

  readonly type = AiCareerSessionCancelledEvent.eventType;

  constructor(
    public readonly payload: AiCareerSessionCancelledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const AiCareerSessionMeetingOperationResultPayloadSchema = z
  .object({
    operation: z.enum(["create", "update", "cancel"]),
    status: z.enum(["success", "failed"]),
    sessionId: z.string().min(1),
  })
  .passthrough();

export type AiCareerSessionMeetingOperationResultPayload = z.infer<
  typeof AiCareerSessionMeetingOperationResultPayloadSchema
>;

@IntegrationEvent({
  type: AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted when AI career async meeting operation completes (success/failed)",
})
export class AiCareerSessionMeetingOperationResultEvent
  implements IEvent<AiCareerSessionMeetingOperationResultPayload>
{
  static readonly eventType = AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT;
  static readonly schema = AiCareerSessionMeetingOperationResultPayloadSchema;

  readonly type = AiCareerSessionMeetingOperationResultEvent.eventType;

  constructor(
    public readonly payload: AiCareerSessionMeetingOperationResultPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

