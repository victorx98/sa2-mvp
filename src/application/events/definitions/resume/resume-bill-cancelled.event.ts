import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const ResumeBillCancelledPayloadSchema = z
  .object({
    resumeId: z.string(),
    studentId: UuidSchema,
    mentorId: UuidSchema,
    jobTitle: z.string(),
    description: z.string().optional(),
    cancelledAt: DateTimeSchema,
  })
  .passthrough();

export type ResumeBillCancelledPayload = z.infer<
  typeof ResumeBillCancelledPayloadSchema
>;

@IntegrationEvent({
  type: "resume.bill.cancelled",
  version: "1.0",
  producers: ["ResumeDomainService"],
  description: "Emitted when a resume bill is cancelled.",
})
export class ResumeBillCancelledEvent extends BaseIntegrationEvent<ResumeBillCancelledPayload> {
  static readonly eventType = "resume.bill.cancelled";
  static readonly schema = ResumeBillCancelledPayloadSchema;
}
