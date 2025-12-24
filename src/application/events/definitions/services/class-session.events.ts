import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";
import {
  MeetingOperationResultPayload,
  MeetingOperationResultPayloadSchema,
} from "./meeting-operation-result.schema";

export const ClassSessionCreatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    classId: UuidSchema,
    mentorId: UuidSchema,
    scheduledStartTime: DateTimeSchema,
    duration: z.number().int().positive(),
    meetingProvider: z.string(),
    topic: z.string(),
    mentorCalendarSlotId: z.string(),
  })
  .passthrough();

export type ClassSessionCreatedPayload = z.infer<
  typeof ClassSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "class_session.session.created",
  version: "1.0",
  producers: ["ClassSessionService"],
  description: "Emitted when a class session is created.",
})
export class ClassSessionCreatedEvent extends BaseIntegrationEvent<ClassSessionCreatedPayload> {
  static readonly eventType = "class_session.session.created";
  static readonly schema = ClassSessionCreatedPayloadSchema;
}

export const ClassSessionUpdatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    classId: UuidSchema,
    mentorId: UuidSchema,
    meetingId: UuidSchema.optional().nullable(),
    oldScheduledStartTime: DateTimeSchema.optional(),
    newScheduledStartTime: DateTimeSchema.optional(),
    oldDuration: z.number().int().positive().optional(),
    newDuration: z.number().int().positive().optional(),
    topic: z.string().optional(),
  })
  .passthrough();

export type ClassSessionUpdatedPayload = z.infer<
  typeof ClassSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: "class_session.session.updated",
  version: "1.0",
  producers: ["ClassSessionService"],
  description: "Emitted when a class session schedule is updated.",
})
export class ClassSessionUpdatedEvent extends BaseIntegrationEvent<ClassSessionUpdatedPayload> {
  static readonly eventType = "class_session.session.updated";
  static readonly schema = ClassSessionUpdatedPayloadSchema;
}

export const ClassSessionCancelledPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    classId: UuidSchema,
    meetingId: UuidSchema.optional().nullable(),
    mentorId: UuidSchema.optional().nullable(),
    cancelledAt: DateTimeSchema.optional(),
    cancelReason: z.string().optional(),
  })
  .passthrough();

export type ClassSessionCancelledPayload = z.infer<
  typeof ClassSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "class_session.session.cancelled",
  version: "1.0",
  producers: ["ClassSessionService"],
  description: "Emitted when a class session is cancelled.",
})
export class ClassSessionCancelledEvent extends BaseIntegrationEvent<ClassSessionCancelledPayload> {
  static readonly eventType = "class_session.session.cancelled";
  static readonly schema = ClassSessionCancelledPayloadSchema;
}

@IntegrationEvent({
  type: "class_session.session.meeting.operation.result",
  version: "1.0",
  producers: ["ClassSessionCreatedEventHandler"],
  description: "Emitted after meeting create/update/cancel for class sessions.",
})
export class ClassSessionMeetingOperationResultEvent extends BaseIntegrationEvent<MeetingOperationResultPayload> {
  static readonly eventType = "class_session.session.meeting.operation.result";
  static readonly schema = MeetingOperationResultPayloadSchema;
}
