import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const MeetingRecordingReadyPayloadSchema = z
  .object({
    meetingId: UuidSchema,
    meetingNo: z.string(),
    recordingUrl: z.string(),
    readyAt: DateTimeSchema,
  })
  .passthrough();

export type MeetingRecordingReadyPayload = z.infer<
  typeof MeetingRecordingReadyPayloadSchema
>;

@IntegrationEvent({
  type: "meeting.recording.ready",
  version: "1.0",
  producers: ["MeetingLifecycleService"],
  description: "Emitted when a meeting recording is ready.",
})
export class MeetingRecordingReadyEvent extends BaseIntegrationEvent<MeetingRecordingReadyPayload> {
  static readonly eventType = "meeting.recording.ready";
  static readonly schema = MeetingRecordingReadyPayloadSchema;
}
