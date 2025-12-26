import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";
import {
  MeetingOperationResultPayload,
  MeetingOperationResultPayloadSchema,
} from "./meeting-operation-result.schema";

export const AiCareerSessionCreatedPayloadSchema = z
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

export type AiCareerSessionCreatedPayload = z.infer<
  typeof AiCareerSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "ai_career.session.created",
  version: "1.0",
  producers: ["AiCareerService"],
  description: "Emitted when an AI career session is created.",
})
export class AiCareerSessionCreatedEvent extends BaseIntegrationEvent<AiCareerSessionCreatedPayload> {
  static readonly eventType = "ai_career.session.created";
  static readonly schema = AiCareerSessionCreatedPayloadSchema;
}

export const AiCareerSessionUpdatedPayloadSchema = z
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

export type AiCareerSessionUpdatedPayload = z.infer<
  typeof AiCareerSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: "ai_career.session.updated",
  version: "1.0",
  producers: ["AiCareerService"],
  description: "Emitted when an AI career session schedule is updated.",
})
export class AiCareerSessionUpdatedEvent extends BaseIntegrationEvent<AiCareerSessionUpdatedPayload> {
  static readonly eventType = "ai_career.session.updated";
  static readonly schema = AiCareerSessionUpdatedPayloadSchema;
}

export const AiCareerSessionCancelledPayloadSchema = z
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

export type AiCareerSessionCancelledPayload = z.infer<
  typeof AiCareerSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "ai_career.session.cancelled",
  version: "1.0",
  producers: ["AiCareerService"],
  description: "Emitted when an AI career session is cancelled.",
})
export class AiCareerSessionCancelledEvent extends BaseIntegrationEvent<AiCareerSessionCancelledPayload> {
  static readonly eventType = "ai_career.session.cancelled";
  static readonly schema = AiCareerSessionCancelledPayloadSchema;
}

@IntegrationEvent({
  type: "ai_career.session.meeting.operation.result",
  version: "1.0",
  producers: ["AiCareerCreatedEventHandler", "SessionProvisioningSaga"],
  description: "Emitted after meeting create/update/cancel for AI career sessions.",
})
export class AiCareerSessionMeetingOperationResultEvent extends BaseIntegrationEvent<MeetingOperationResultPayload> {
  static readonly eventType = "ai_career.session.meeting.operation.result";
  static readonly schema = MeetingOperationResultPayloadSchema;
}
