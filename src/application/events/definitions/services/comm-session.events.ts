import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";
import {
  MeetingOperationResultPayload,
  MeetingOperationResultPayloadSchema,
} from "./meeting-operation-result.schema";

export const CommSessionCreatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    studentId: UuidSchema,
    mentorId: UuidSchema.optional().nullable(),
    counselorId: UuidSchema.optional().nullable(),
    scheduledStartTime: DateTimeSchema,
    duration: z.number().int().positive(),
    meetingProvider: z.string(),
    topic: z.string(),
    studentCalendarSlotId: z.string(),
    mentorCalendarSlotId: z.string().optional().nullable(),
  })
  .passthrough();

export type CommSessionCreatedPayload = z.infer<
  typeof CommSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "comm_session.session.created",
  version: "1.0",
  producers: ["CommSessionService"],
  description: "Emitted when a communication session is created.",
})
export class CommSessionCreatedEvent extends BaseIntegrationEvent<CommSessionCreatedPayload> {
  static readonly eventType = "comm_session.session.created";
  static readonly schema = CommSessionCreatedPayloadSchema;
}

export const CommSessionUpdatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    meetingId: UuidSchema.optional().nullable(),
    oldScheduledAt: DateTimeSchema.optional(),
    newScheduledAt: DateTimeSchema.optional(),
    oldDuration: z.number().int().positive().optional(),
    newDuration: z.number().int().positive().optional(),
    newTitle: z.string().optional(),
    studentId: UuidSchema.optional(),
    mentorId: UuidSchema.optional().nullable(),
    counselorId: UuidSchema.optional().nullable(),
    meetingProvider: z.string().optional(),
  })
  .passthrough();

export type CommSessionUpdatedPayload = z.infer<
  typeof CommSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: "comm_session.session.updated",
  version: "1.0",
  producers: ["CommSessionService"],
  description: "Emitted when a communication session schedule is updated.",
})
export class CommSessionUpdatedEvent extends BaseIntegrationEvent<CommSessionUpdatedPayload> {
  static readonly eventType = "comm_session.session.updated";
  static readonly schema = CommSessionUpdatedPayloadSchema;
}

export const CommSessionCancelledPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    meetingId: UuidSchema.optional().nullable(),
    studentId: UuidSchema.optional(),
    mentorId: UuidSchema.optional().nullable(),
    counselorId: UuidSchema.optional().nullable(),
    scheduledAt: DateTimeSchema.optional(),
    cancelReason: z.string().optional(),
    cancelledAt: DateTimeSchema.optional(),
    meetingProvider: z.string().optional(),
  })
  .passthrough();

export type CommSessionCancelledPayload = z.infer<
  typeof CommSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "comm_session.session.cancelled",
  version: "1.0",
  producers: ["CommSessionService"],
  description: "Emitted when a communication session is cancelled.",
})
export class CommSessionCancelledEvent extends BaseIntegrationEvent<CommSessionCancelledPayload> {
  static readonly eventType = "comm_session.session.cancelled";
  static readonly schema = CommSessionCancelledPayloadSchema;
}

@IntegrationEvent({
  type: "comm_session.session.meeting.operation.result",
  version: "1.0",
  producers: ["CommSessionCreatedEventHandler"],
  description: "Emitted after meeting create/update/cancel for communication sessions.",
})
export class CommSessionMeetingOperationResultEvent extends BaseIntegrationEvent<MeetingOperationResultPayload> {
  static readonly eventType = "comm_session.session.meeting.operation.result";
  static readonly schema = MeetingOperationResultPayloadSchema;
}
