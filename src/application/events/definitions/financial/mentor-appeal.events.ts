import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const MentorAppealCreatedPayloadSchema = z
  .object({
    appealId: UuidSchema,
    mentorId: UuidSchema,
    counselorId: UuidSchema,
    appealAmount: z.string().optional().nullable(),
    appealType: z.string(),
    currency: z.string().optional().nullable(),
    paymentMonth: z.string(),
    createdAt: DateTimeSchema,
  })
  .passthrough();

export type MentorAppealCreatedPayload = z.infer<
  typeof MentorAppealCreatedPayloadSchema
>;

@IntegrationEvent({
  type: "financial.appeal.created",
  version: "1.0",
  producers: ["CreateMentorAppealCommand", "MentorAppealService"],
  description: "Emitted when a mentor appeal is created.",
})
export class MentorAppealCreatedEvent extends BaseIntegrationEvent<MentorAppealCreatedPayload> {
  static readonly eventType = "financial.appeal.created";
  static readonly schema = MentorAppealCreatedPayloadSchema;
}

export const MentorAppealApprovedPayloadSchema = z
  .object({
    appealId: UuidSchema,
    mentorId: UuidSchema,
    counselorId: UuidSchema,
    appealAmount: z.string().optional().nullable(),
    approvedBy: UuidSchema,
    approvedAt: DateTimeSchema,
    currency: z.string().optional().nullable(),
  })
  .passthrough();

export type MentorAppealApprovedPayload = z.infer<
  typeof MentorAppealApprovedPayloadSchema
>;

@IntegrationEvent({
  type: "financial.appeal.approved",
  version: "1.0",
  producers: ["ApproveMentorAppealCommand", "MentorAppealService"],
  description: "Emitted when a mentor appeal is approved.",
})
export class MentorAppealApprovedEvent extends BaseIntegrationEvent<MentorAppealApprovedPayload> {
  static readonly eventType = "financial.appeal.approved";
  static readonly schema = MentorAppealApprovedPayloadSchema;
}

export const MentorAppealRejectedPayloadSchema = z
  .object({
    appealId: UuidSchema,
    mentorId: UuidSchema,
    counselorId: UuidSchema,
    rejectionReason: z.string(),
    rejectedBy: UuidSchema,
    rejectedAt: DateTimeSchema,
  })
  .passthrough();

export type MentorAppealRejectedPayload = z.infer<
  typeof MentorAppealRejectedPayloadSchema
>;

@IntegrationEvent({
  type: "financial.appeal.rejected",
  version: "1.0",
  producers: ["RejectMentorAppealCommand", "MentorAppealService"],
  description: "Emitted when a mentor appeal is rejected.",
})
export class MentorAppealRejectedEvent extends BaseIntegrationEvent<MentorAppealRejectedPayload> {
  static readonly eventType = "financial.appeal.rejected";
  static readonly schema = MentorAppealRejectedPayloadSchema;
}
