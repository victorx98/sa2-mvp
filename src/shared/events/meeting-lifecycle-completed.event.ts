import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { MEETING_LIFECYCLE_COMPLETED_EVENT } from "./event-constants";

export { MEETING_LIFECYCLE_COMPLETED_EVENT };

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const MeetingTimeSegmentSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});

export type MeetingTimeSegment = z.infer<typeof MeetingTimeSegmentSchema>;

export const MeetingLifecycleCompletedPayloadSchema = z.object({
  meetingId: z.string().min(1),
  meetingNo: z.string().min(1),
  provider: z.string().min(1),
  status: z.literal("ended"),
  scheduleStartTime: DateTimeSchema,
  scheduleDuration: z.number().int().positive(),
  actualDuration: z.number().int().nonnegative(),
  endedAt: DateTimeSchema,
  timeList: z.array(MeetingTimeSegmentSchema),
  recordingUrl: z.string().min(1).nullable(),
});

export type MeetingLifecycleCompletedPayload = z.infer<
  typeof MeetingLifecycleCompletedPayloadSchema
>;

@IntegrationEvent({
  type: MEETING_LIFECYCLE_COMPLETED_EVENT,
  version: "4.1",
  producers: ["MeetingModule"],
  description: "Emitted when a meeting physically ends (webhook-driven)",
})
export class MeetingLifecycleCompletedEvent
  implements IEvent<MeetingLifecycleCompletedPayload>
{
  static readonly eventType = MEETING_LIFECYCLE_COMPLETED_EVENT;
  static readonly schema = MeetingLifecycleCompletedPayloadSchema;

  readonly type = MeetingLifecycleCompletedEvent.eventType;

  constructor(
    public readonly payload: MeetingLifecycleCompletedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

