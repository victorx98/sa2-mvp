import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const MeetingStatusChangedPayloadSchema = z
  .object({
    meetingId: UuidSchema,
    meetingNo: z.string(),
    oldStatus: z.string(),
    newStatus: z.string(),
    changedAt: DateTimeSchema,
  })
  .passthrough();

export type MeetingStatusChangedPayload = z.infer<
  typeof MeetingStatusChangedPayloadSchema
>;

@IntegrationEvent({
  type: "meeting.status.changed",
  version: "1.0",
  producers: ["MeetingLifecycleService"],
  description: "Emitted when a meeting status changes.",
})
export class MeetingStatusChangedEvent extends BaseIntegrationEvent<MeetingStatusChangedPayload> {
  static readonly eventType = "meeting.status.changed";
  static readonly schema = MeetingStatusChangedPayloadSchema;
}
