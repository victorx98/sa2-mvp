import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  REGULAR_MENTORING_SESSION_CANCELLED_EVENT,
  REGULAR_MENTORING_SESSION_CREATED_EVENT,
  REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
  REGULAR_MENTORING_SESSION_UPDATED_EVENT,
} from "./event-constants";

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const RegularMentoringSessionCreatedPayloadSchema = z.object({
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

export type RegularMentoringSessionCreatedPayload = z.infer<
  typeof RegularMentoringSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: REGULAR_MENTORING_SESSION_CREATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after regular mentoring session is created (async meeting creation trigger)",
})
export class RegularMentoringSessionCreatedEvent
  implements IEvent<RegularMentoringSessionCreatedPayload>
{
  static readonly eventType = REGULAR_MENTORING_SESSION_CREATED_EVENT;
  static readonly schema = RegularMentoringSessionCreatedPayloadSchema;

  readonly type = RegularMentoringSessionCreatedEvent.eventType;

  constructor(
    public readonly payload: RegularMentoringSessionCreatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const RegularMentoringSessionUpdatedPayloadSchema = z.object({
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

export type RegularMentoringSessionUpdatedPayload = z.infer<
  typeof RegularMentoringSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: REGULAR_MENTORING_SESSION_UPDATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description:
    "Emitted after regular mentoring session is rescheduled (async meeting update trigger)",
})
export class RegularMentoringSessionUpdatedEvent
  implements IEvent<RegularMentoringSessionUpdatedPayload>
{
  static readonly eventType = REGULAR_MENTORING_SESSION_UPDATED_EVENT;
  static readonly schema = RegularMentoringSessionUpdatedPayloadSchema;

  readonly type = RegularMentoringSessionUpdatedEvent.eventType;

  constructor(
    public readonly payload: RegularMentoringSessionUpdatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const RegularMentoringSessionCancelledPayloadSchema = z.object({
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

export type RegularMentoringSessionCancelledPayload = z.infer<
  typeof RegularMentoringSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: REGULAR_MENTORING_SESSION_CANCELLED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description:
    "Emitted after regular mentoring session is cancelled (async meeting cancellation trigger)",
})
export class RegularMentoringSessionCancelledEvent
  implements IEvent<RegularMentoringSessionCancelledPayload>
{
  static readonly eventType = REGULAR_MENTORING_SESSION_CANCELLED_EVENT;
  static readonly schema = RegularMentoringSessionCancelledPayloadSchema;

  readonly type = RegularMentoringSessionCancelledEvent.eventType;

  constructor(
    public readonly payload: RegularMentoringSessionCancelledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const RegularMentoringSessionMeetingOperationResultPayloadSchema = z
  .object({
    operation: z.enum(["create", "update", "cancel"]),
    status: z.enum(["success", "failed"]),
    sessionId: z.string().min(1),
  })
  .passthrough();

export type RegularMentoringSessionMeetingOperationResultPayload = z.infer<
  typeof RegularMentoringSessionMeetingOperationResultPayloadSchema
>;

@IntegrationEvent({
  type: REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description:
    "Emitted when regular mentoring async meeting operation completes (success/failed)",
})
export class RegularMentoringSessionMeetingOperationResultEvent
  implements IEvent<RegularMentoringSessionMeetingOperationResultPayload>
{
  static readonly eventType = REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT;
  static readonly schema = RegularMentoringSessionMeetingOperationResultPayloadSchema;

  readonly type = RegularMentoringSessionMeetingOperationResultEvent.eventType;

  constructor(
    public readonly payload: RegularMentoringSessionMeetingOperationResultPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

