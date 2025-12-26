import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";
import {
  MeetingOperationResultPayload,
  MeetingOperationResultPayloadSchema,
} from "./meeting-operation-result.schema";

export const GapAnalysisSessionCreatedPayloadSchema = z
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

export type GapAnalysisSessionCreatedPayload = z.infer<
  typeof GapAnalysisSessionCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "gap_analysis.session.created",
  version: "1.0",
  producers: ["GapAnalysisService"],
  description: "Emitted when a gap analysis session is created.",
})
export class GapAnalysisSessionCreatedEvent extends BaseIntegrationEvent<GapAnalysisSessionCreatedPayload> {
  static readonly eventType = "gap_analysis.session.created";
  static readonly schema = GapAnalysisSessionCreatedPayloadSchema;
}

export const GapAnalysisSessionUpdatedPayloadSchema = z
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

export type GapAnalysisSessionUpdatedPayload = z.infer<
  typeof GapAnalysisSessionUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: "gap_analysis.session.updated",
  version: "1.0",
  producers: ["GapAnalysisService"],
  description: "Emitted when a gap analysis session schedule is updated.",
})
export class GapAnalysisSessionUpdatedEvent extends BaseIntegrationEvent<GapAnalysisSessionUpdatedPayload> {
  static readonly eventType = "gap_analysis.session.updated";
  static readonly schema = GapAnalysisSessionUpdatedPayloadSchema;
}

export const GapAnalysisSessionCancelledPayloadSchema = z
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

export type GapAnalysisSessionCancelledPayload = z.infer<
  typeof GapAnalysisSessionCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "gap_analysis.session.cancelled",
  version: "1.0",
  producers: ["GapAnalysisService"],
  description: "Emitted when a gap analysis session is cancelled.",
})
export class GapAnalysisSessionCancelledEvent extends BaseIntegrationEvent<GapAnalysisSessionCancelledPayload> {
  static readonly eventType = "gap_analysis.session.cancelled";
  static readonly schema = GapAnalysisSessionCancelledPayloadSchema;
}

@IntegrationEvent({
  type: "gap_analysis.session.meeting.operation.result",
  version: "1.0",
  producers: ["GapAnalysisCreatedEventHandler", "SessionProvisioningSaga"],
  description: "Emitted after meeting create/update/cancel for gap analysis sessions.",
})
export class GapAnalysisSessionMeetingOperationResultEvent extends BaseIntegrationEvent<MeetingOperationResultPayload> {
  static readonly eventType = "gap_analysis.session.meeting.operation.result";
  static readonly schema = MeetingOperationResultPayloadSchema;
}
