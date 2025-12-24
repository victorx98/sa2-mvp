import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { UuidSchema } from "../schema-utils";

export const ServiceSessionCompletedPayloadSchema = z
  .object({
    sessionId: UuidSchema,
    studentId: UuidSchema,
    mentorId: UuidSchema.optional().nullable(),
    referenceId: z.string().optional().nullable(),
    serviceTypeCode: z.string(),
    actualDurationMinutes: z.number().int().nonnegative(),
    durationMinutes: z.number().int().nonnegative(),
    allowBilling: z.boolean(),
    sessionTypeCode: z.string(),
  })
  .passthrough();

export type ServiceSessionCompletedPayload = z.infer<
  typeof ServiceSessionCompletedPayloadSchema
>;

@IntegrationEvent({
  type: "services.session.completed",
  version: "1.0",
  producers: [
    "AiCareerCreatedEventHandler",
    "GapAnalysisCreatedEventHandler",
    "RegularMentoringCreatedEventHandler",
  ],
  description: "Emitted when a service session is completed.",
})
export class ServiceSessionCompletedEvent extends BaseIntegrationEvent<ServiceSessionCompletedPayload> {
  static readonly eventType = "services.session.completed";
  static readonly schema = ServiceSessionCompletedPayloadSchema;
}
