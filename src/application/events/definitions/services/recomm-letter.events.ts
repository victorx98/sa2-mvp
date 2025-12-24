import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const RecommLetterBilledPayloadSchema = z
  .object({
    sessionId: UuidSchema.optional().nullable(),
    studentId: UuidSchema,
    mentorId: UuidSchema.optional().nullable(),
    referenceId: z.string().optional().nullable(),
    serviceTypeCode: z.string(),
    letterType: z.string(),
    packageType: z.string().optional(),
    description: z.string().optional(),
    billedAt: DateTimeSchema.optional(),
  })
  .passthrough();

export type RecommLetterBilledPayload = z.infer<
  typeof RecommLetterBilledPayloadSchema
>;

@IntegrationEvent({
  type: "recomm_letter.billed",
  version: "1.0",
  producers: ["RecommLetterService"],
  description: "Emitted when a recommendation letter is billed.",
})
export class RecommLetterBilledEvent extends BaseIntegrationEvent<RecommLetterBilledPayload> {
  static readonly eventType = "recomm_letter.billed";
  static readonly schema = RecommLetterBilledPayloadSchema;
}

export const RecommLetterBillCancelledPayloadSchema = z
  .object({
    sessionId: UuidSchema.optional().nullable(),
    studentId: UuidSchema,
    mentorId: UuidSchema.optional().nullable(),
    referenceId: z.string().optional().nullable(),
    serviceTypeCode: z.string(),
    letterType: z.string(),
    packageType: z.string().optional(),
    description: z.string().optional(),
    cancelledAt: DateTimeSchema.optional(),
  })
  .passthrough();

export type RecommLetterBillCancelledPayload = z.infer<
  typeof RecommLetterBillCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "recomm_letter.bill.cancelled",
  version: "1.0",
  producers: ["RecommLetterService"],
  description: "Emitted when a recommendation letter bill is cancelled.",
})
export class RecommLetterBillCancelledEvent extends BaseIntegrationEvent<RecommLetterBillCancelledPayload> {
  static readonly eventType = "recomm_letter.bill.cancelled";
  static readonly schema = RecommLetterBillCancelledPayloadSchema;
}
