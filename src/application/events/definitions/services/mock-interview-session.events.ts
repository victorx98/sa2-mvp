import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const MockInterviewCreatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    studentId: UuidSchema,
    createdByCounselorId: UuidSchema.optional().nullable(),
    scheduledAt: DateTimeSchema,
    scheduleDuration: z.number().int().positive(),
    title: z.string(),
    interviewType: z.string().optional(),
    studentCalendarSlotId: z.string(),
  })
  .passthrough();

export type MockInterviewCreatedPayload = z.infer<
  typeof MockInterviewCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "mock_interview.session.created",
  version: "1.0",
  producers: ["MockInterviewService"],
  description: "Emitted when a mock interview session is created.",
})
export class MockInterviewCreatedEvent extends BaseIntegrationEvent<MockInterviewCreatedPayload> {
  static readonly eventType = "mock_interview.session.created";
  static readonly schema = MockInterviewCreatedPayloadSchema;
}

export const MockInterviewUpdatedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    oldScheduledAt: DateTimeSchema.optional(),
    newScheduledAt: DateTimeSchema.optional(),
    oldDuration: z.number().int().positive().optional(),
    newDuration: z.number().int().positive().optional(),
    newTitle: z.string().optional(),
    studentId: UuidSchema.optional(),
    createdByCounselorId: UuidSchema.optional().nullable(),
  })
  .passthrough();

export type MockInterviewUpdatedPayload = z.infer<
  typeof MockInterviewUpdatedPayloadSchema
>;

@IntegrationEvent({
  type: "mock_interview.session.updated",
  version: "1.0",
  producers: ["MockInterviewService"],
  description: "Emitted when a mock interview session is updated.",
})
export class MockInterviewUpdatedEvent extends BaseIntegrationEvent<MockInterviewUpdatedPayload> {
  static readonly eventType = "mock_interview.session.updated";
  static readonly schema = MockInterviewUpdatedPayloadSchema;
}

export const MockInterviewCancelledPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    studentId: UuidSchema.optional(),
    createdByCounselorId: UuidSchema.optional().nullable(),
    scheduledAt: DateTimeSchema.optional(),
    cancelReason: z.string().optional(),
    cancelledAt: DateTimeSchema.optional(),
  })
  .passthrough();

export type MockInterviewCancelledPayload = z.infer<
  typeof MockInterviewCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "mock_interview.session.cancelled",
  version: "1.0",
  producers: ["MockInterviewService"],
  description: "Emitted when a mock interview session is cancelled.",
})
export class MockInterviewCancelledEvent extends BaseIntegrationEvent<MockInterviewCancelledPayload> {
  static readonly eventType = "mock_interview.session.cancelled";
  static readonly schema = MockInterviewCancelledPayloadSchema;
}
