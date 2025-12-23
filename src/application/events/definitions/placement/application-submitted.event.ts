import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const PlacementApplicationSubmittedPayloadSchema = z
  .object({
    id: UuidSchema,
    service_type: z.literal("job_application"),
    student_user_id: UuidSchema,
    provider_user_id: UuidSchema,
    consumed_units: z.number().int().positive(),
    unit_type: z.literal("count"),
    completed_time: DateTimeSchema,
    title: z.string().optional(),
  })
  .passthrough();

export type PlacementApplicationSubmittedPayload = z.infer<
  typeof PlacementApplicationSubmittedPayloadSchema
>;

@IntegrationEvent({
  type: "placement.application.submitted",
  version: "1.0",
  producers: ["JobApplicationService", "UpdateJobApplicationStatusCommand"],
  description: "Emitted when a placement application is submitted.",
})
export class PlacementApplicationSubmittedEvent extends BaseIntegrationEvent<PlacementApplicationSubmittedPayload> {
  static readonly eventType = "placement.application.submitted";
  static readonly schema = PlacementApplicationSubmittedPayloadSchema;
}
