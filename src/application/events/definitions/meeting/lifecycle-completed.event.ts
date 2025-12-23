import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const MeetingTimeSegmentSchema = z.object({
  start: DateTimeSchema,
  end: DateTimeSchema,
});

export type MeetingTimeSegment = z.infer<typeof MeetingTimeSegmentSchema>;

export const MeetingLifecycleCompletedPayloadSchema = z
  .object({
    meetingId: UuidSchema,
    meetingNo: z.string(),
    provider: z.string(),
    status: z.literal("ended"),
    scheduleStartTime: DateTimeSchema,
    scheduleDuration: z.number().int().nonnegative(),
    actualDuration: z.number().int().nonnegative(),
    endedAt: DateTimeSchema,
    timeList: z.array(MeetingTimeSegmentSchema),
    recordingUrl: z.string().nullable().optional(),
  })
  .passthrough();

export type MeetingLifecycleCompletedPayload = z.infer<
  typeof MeetingLifecycleCompletedPayloadSchema
>;

@IntegrationEvent({
  type: "meeting.lifecycle.completed",
  version: "1.0",
  producers: ["MeetingLifecycleService"],
  description: "Emitted when a meeting lifecycle completes.",
})
export class MeetingLifecycleCompletedEvent extends BaseIntegrationEvent<MeetingLifecycleCompletedPayload> {
  static readonly eventType = "meeting.lifecycle.completed";
  static readonly schema = MeetingLifecycleCompletedPayloadSchema;
}
