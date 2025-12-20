import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  COMM_SESSION_CANCELLED_EVENT,
  COMM_SESSION_CREATED_EVENT,
  COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
  COMM_SESSION_UPDATED_EVENT,
} from "./event-constants";

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const CommSessionCreatedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  counselorId: z.string().min(1),
  scheduledStartTime: z.string().datetime(),
  duration: z.number().int().positive(),
  meetingProvider: z.string().min(1),
  topic: z.string().min(1),
  studentCalendarSlotId: z.string().min(1),
  mentorCalendarSlotId: z.string().min(1).optional(),
});

export type CommSessionCreatedPayload = z.infer<typeof CommSessionCreatedPayloadSchema>;

@IntegrationEvent({
  type: COMM_SESSION_CREATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after comm session is created (async meeting creation trigger)",
})
export class CommSessionCreatedEvent implements IEvent<CommSessionCreatedPayload> {
  static readonly eventType = COMM_SESSION_CREATED_EVENT;
  static readonly schema = CommSessionCreatedPayloadSchema;

  readonly type = CommSessionCreatedEvent.eventType;

  constructor(
    public readonly payload: CommSessionCreatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const CommSessionUpdatedPayloadSchema = z.object({
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

export type CommSessionUpdatedPayload = z.infer<typeof CommSessionUpdatedPayloadSchema>;

@IntegrationEvent({
  type: COMM_SESSION_UPDATED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after comm session is rescheduled (async meeting update trigger)",
})
export class CommSessionUpdatedEvent implements IEvent<CommSessionUpdatedPayload> {
  static readonly eventType = COMM_SESSION_UPDATED_EVENT;
  static readonly schema = CommSessionUpdatedPayloadSchema;

  readonly type = CommSessionUpdatedEvent.eventType;

  constructor(
    public readonly payload: CommSessionUpdatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const CommSessionCancelledPayloadSchema = z.object({
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

export type CommSessionCancelledPayload = z.infer<typeof CommSessionCancelledPayloadSchema>;

@IntegrationEvent({
  type: COMM_SESSION_CANCELLED_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted after comm session is cancelled (async meeting cancellation trigger)",
})
export class CommSessionCancelledEvent implements IEvent<CommSessionCancelledPayload> {
  static readonly eventType = COMM_SESSION_CANCELLED_EVENT;
  static readonly schema = CommSessionCancelledPayloadSchema;

  readonly type = CommSessionCancelledEvent.eventType;

  constructor(
    public readonly payload: CommSessionCancelledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const CommSessionMeetingOperationResultPayloadSchema = z
  .object({
    operation: z.enum(["create", "update", "cancel"]),
    status: z.enum(["success", "failed"]),
    sessionId: z.string().min(1),
  })
  .passthrough();

export type CommSessionMeetingOperationResultPayload = z.infer<
  typeof CommSessionMeetingOperationResultPayloadSchema
>;

@IntegrationEvent({
  type: COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
  version: "2.0",
  producers: ["ServicesModule"],
  description: "Emitted when comm session async meeting operation completes (success/failed)",
})
export class CommSessionMeetingOperationResultEvent
  implements IEvent<CommSessionMeetingOperationResultPayload>
{
  static readonly eventType = COMM_SESSION_MEETING_OPERATION_RESULT_EVENT;
  static readonly schema = CommSessionMeetingOperationResultPayloadSchema;

  readonly type = CommSessionMeetingOperationResultEvent.eventType;

  constructor(
    public readonly payload: CommSessionMeetingOperationResultPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

