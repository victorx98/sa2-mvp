import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  CLASS_SESSION_CANCELLED_EVENT,
  CLASS_SESSION_CREATED_EVENT,
  CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  CLASS_SESSION_UPDATED_EVENT,
} from "./event-constants";

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const ClassSessionCreatedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  classId: z.string().min(1),
  mentorId: z.string().min(1),
  scheduledStartTime: z.string().datetime(),
  duration: z.number().int().positive(),
  meetingProvider: z.string().min(1),
  topic: z.string().min(1),
  mentorCalendarSlotId: z.string().min(1),
});

export type ClassSessionCreatedPayload = z.infer<typeof ClassSessionCreatedPayloadSchema>;

@IntegrationEvent({
  type: CLASS_SESSION_CREATED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted after class session is created (async meeting creation trigger)",
})
export class ClassSessionCreatedEvent implements IEvent<ClassSessionCreatedPayload> {
  static readonly eventType = CLASS_SESSION_CREATED_EVENT;
  static readonly schema = ClassSessionCreatedPayloadSchema;

  readonly type = ClassSessionCreatedEvent.eventType;

  constructor(
    public readonly payload: ClassSessionCreatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const ClassSessionUpdatedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  classId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
  oldScheduledStartTime: DateTimeSchema.optional(),
  newScheduledStartTime: DateTimeSchema,
  oldDuration: z.number().int().positive(),
  newDuration: z.number().int().positive(),
  topic: z.string().min(1),
});

export type ClassSessionUpdatedPayload = z.infer<typeof ClassSessionUpdatedPayloadSchema>;

@IntegrationEvent({
  type: CLASS_SESSION_UPDATED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted after class session is rescheduled (async meeting update trigger)",
})
export class ClassSessionUpdatedEvent implements IEvent<ClassSessionUpdatedPayload> {
  static readonly eventType = CLASS_SESSION_UPDATED_EVENT;
  static readonly schema = ClassSessionUpdatedPayloadSchema;

  readonly type = ClassSessionUpdatedEvent.eventType;

  constructor(
    public readonly payload: ClassSessionUpdatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const ClassSessionCancelledPayloadSchema = z.object({
  sessionId: z.string().min(1),
  classId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
  mentorId: z.string().min(1).optional(),
  cancelledAt: DateTimeSchema.optional(),
  cancelReason: z.string().min(1).optional(),
});

export type ClassSessionCancelledPayload = z.infer<typeof ClassSessionCancelledPayloadSchema>;

@IntegrationEvent({
  type: CLASS_SESSION_CANCELLED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted after class session is cancelled (async meeting cancellation trigger)",
})
export class ClassSessionCancelledEvent implements IEvent<ClassSessionCancelledPayload> {
  static readonly eventType = CLASS_SESSION_CANCELLED_EVENT;
  static readonly schema = ClassSessionCancelledPayloadSchema;

  readonly type = ClassSessionCancelledEvent.eventType;

  constructor(
    public readonly payload: ClassSessionCancelledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export const ClassSessionMeetingOperationResultPayloadSchema = z
  .object({
    operation: z.enum(["create", "update", "cancel"]),
    status: z.enum(["success", "failed"]),
    sessionId: z.string().min(1),
  })
  .passthrough();

export type ClassSessionMeetingOperationResultPayload = z.infer<
  typeof ClassSessionMeetingOperationResultPayloadSchema
>;

@IntegrationEvent({
  type: CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted when class session async meeting operation completes (success/failed)",
})
export class ClassSessionMeetingOperationResultEvent
  implements IEvent<ClassSessionMeetingOperationResultPayload>
{
  static readonly eventType = CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT;
  static readonly schema = ClassSessionMeetingOperationResultPayloadSchema;

  readonly type = ClassSessionMeetingOperationResultEvent.eventType;

  constructor(
    public readonly payload: ClassSessionMeetingOperationResultPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

