import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";
import {
  MeetingOperationResultPayload,
  MeetingOperationResultPayloadSchema,
} from "./meeting-operation-result.schema";

export const RegularMentoringSessionCreatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    studentId: UuidSchema,
    mentorId: UuidSchema,
    counselorId: UuidSchema.optional(),
    scheduledStartTime: DateTimeSchema,
    duration: z.number().int().positive(),
    meetingProvider: z.string(),
    topic: z.string(),
    mentorCalendarSlotId: z.string(),
    studentCalendarSlotId: z.string(),
  })
  .passthrough();

export type RegularMentoringSessionCreatedPayload = z.infer<
  typeof RegularMentoringSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "regular_mentoring.session.created",
  version: "1.0",
  producers: ["RegularMentoringService"],
  description: "Emitted when a regular mentoring session is created.",
})
export class RegularMentoringSessionCreatedEvent extends BaseIntegrationEvent<RegularMentoringSessionCreatedPayload> {
  static readonly eventType = "regular_mentoring.session.created";
  static readonly schema = RegularMentoringSessionCreatedPayloadSchema;
}

export const RegularMentoringSessionUpdatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    meetingId: UuidSchema.optional().nullable(),
    oldScheduledAt: DateTimeSchema.optional(),
    newScheduledAt: DateTimeSchema.optional(),
    oldDuration: z.number().int().positive().optional(),
    newDuration: z.number().int().positive().optional(),
    newTitle: z.string().optional(),
    mentorId: UuidSchema.optional(),
    studentId: UuidSchema.optional(),
    counselorId: UuidSchema.optional(),
    meetingProvider: z.string().optional(),
  })
  .passthrough();

export type RegularMentoringSessionUpdatedPayload = z.infer<
  typeof RegularMentoringSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: "regular_mentoring.session.updated",
  version: "1.0",
  producers: ["RegularMentoringService"],
  description: "Emitted when a regular mentoring session schedule is updated.",
})
export class RegularMentoringSessionUpdatedEvent extends BaseIntegrationEvent<RegularMentoringSessionUpdatedPayload> {
  static readonly eventType = "regular_mentoring.session.updated";
  static readonly schema = RegularMentoringSessionUpdatedPayloadSchema;
}

export const RegularMentoringSessionCancelledPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    meetingId: UuidSchema.optional().nullable(),
    studentId: UuidSchema.optional(),
    mentorId: UuidSchema.optional(),
    counselorId: UuidSchema.optional(),
    scheduledAt: DateTimeSchema.optional(),
    cancelReason: z.string().optional(),
    cancelledAt: DateTimeSchema.optional(),
    meetingProvider: z.string().optional(),
  })
  .passthrough();

export type RegularMentoringSessionCancelledPayload = z.infer<
  typeof RegularMentoringSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "regular_mentoring.session.cancelled",
  version: "1.0",
  producers: ["RegularMentoringService"],
  description: "Emitted when a regular mentoring session is cancelled.",
})
export class RegularMentoringSessionCancelledEvent extends BaseIntegrationEvent<RegularMentoringSessionCancelledPayload> {
  static readonly eventType = "regular_mentoring.session.cancelled";
  static readonly schema = RegularMentoringSessionCancelledPayloadSchema;
}

@IntegrationEvent({
  type: "regular_mentoring.session.meeting.operation.result",
  version: "1.0",
  producers: ["RegularMentoringCreatedEventHandler", "SessionProvisioningSaga"],
  description: "Emitted after meeting create/update/cancel for regular mentoring sessions.",
})
export class RegularMentoringSessionMeetingOperationResultEvent extends BaseIntegrationEvent<MeetingOperationResultPayload> {
  static readonly eventType = "regular_mentoring.session.meeting.operation.result";
  static readonly schema = MeetingOperationResultPayloadSchema;
}
