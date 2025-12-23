import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const JobApplicationStatusRolledBackPayloadSchema = z
  .object({
    applicationId: UuidSchema,
    previousStatus: z.string(),
    newStatus: z.string(),
    changedBy: UuidSchema,
    changedAt: DateTimeSchema,
    rollbackReason: z.string(),
    assignedMentorId: UuidSchema.optional().nullable(),
  })
  .passthrough();

export type JobApplicationStatusRolledBackPayload = z.infer<
  typeof JobApplicationStatusRolledBackPayloadSchema
>;

@IntegrationEvent({
  type: "placement.application.status_rolled_back",
  version: "1.0",
  producers: ["JobApplicationService", "RollbackJobApplicationStatusCommand"],
  description: "Emitted when a placement application status is rolled back.",
})
export class JobApplicationStatusRolledBackEvent extends BaseIntegrationEvent<JobApplicationStatusRolledBackPayload> {
  static readonly eventType = "placement.application.status_rolled_back";
  static readonly schema = JobApplicationStatusRolledBackPayloadSchema;
}
