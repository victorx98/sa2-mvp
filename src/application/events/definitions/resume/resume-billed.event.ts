import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const ResumeBilledPayloadSchema = z
  .object({
    resumeId: z.string(),
    studentId: UuidSchema,
    mentorId: UuidSchema,
    jobTitle: z.string(),
    description: z.string().optional(),
    billedAt: DateTimeSchema,
  })
  .passthrough();

export type ResumeBilledPayload = z.infer<typeof ResumeBilledPayloadSchema>;

@IntegrationEvent({
  type: "resume.billed",
  version: "1.0",
  producers: ["ResumeDomainService"],
  description: "Emitted when a resume is billed.",
})
export class ResumeBilledEvent extends BaseIntegrationEvent<ResumeBilledPayload> {
  static readonly eventType = "resume.billed";
  static readonly schema = ResumeBilledPayloadSchema;
}
