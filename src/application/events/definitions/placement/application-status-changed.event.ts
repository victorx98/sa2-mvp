import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const JobApplicationStatusChangedPayloadSchema = z
  .object({
    applicationId: UuidSchema,
    previousStatus: z.string().nullable().optional(),
    newStatus: z.string(),
    changedBy: UuidSchema.optional().nullable(),
    changedAt: DateTimeSchema,
    assignedMentorId: UuidSchema.optional().nullable(),
  })
  .passthrough();

export type JobApplicationStatusChangedPayload = z.infer<
  typeof JobApplicationStatusChangedPayloadSchema
>;

@IntegrationEvent({
  type: "placement.application.status_changed",
  version: "1.0",
  producers: [
    "JobApplicationService",
    "AssignReferralMentorCommand",
    "CreateManualJobApplicationCommand",
    "RecommendReferralApplicationsBatchCommand",
    "UpdateJobApplicationStatusCommand",
    "CreateProxyApplicationsBatchCommand",
  ],
  description: "Emitted when a placement application status changes.",
})
export class JobApplicationStatusChangedEvent extends BaseIntegrationEvent<JobApplicationStatusChangedPayload> {
  static readonly eventType = "placement.application.status_changed";
  static readonly schema = JobApplicationStatusChangedPayloadSchema;
}
