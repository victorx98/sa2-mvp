import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { MEETING_RECORDING_READY_EVENT } from "./event-constants";

export { MEETING_RECORDING_READY_EVENT };

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const MeetingRecordingReadyPayloadSchema = z.object({
  meetingId: z.string().min(1),
  meetingNo: z.string().min(1),
  recordingUrl: z.string().min(1),
  readyAt: DateTimeSchema,
});

export type MeetingRecordingReadyPayload = z.infer<
  typeof MeetingRecordingReadyPayloadSchema
>;

@IntegrationEvent({
  type: MEETING_RECORDING_READY_EVENT,
  version: "4.1",
  producers: ["MeetingModule"],
  description: "Emitted when meeting recording becomes available",
})
export class MeetingRecordingReadyEvent
  implements IEvent<MeetingRecordingReadyPayload>
{
  static readonly eventType = MEETING_RECORDING_READY_EVENT;
  static readonly schema = MeetingRecordingReadyPayloadSchema;

  readonly type = MeetingRecordingReadyEvent.eventType;

  constructor(
    public readonly payload: MeetingRecordingReadyPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

