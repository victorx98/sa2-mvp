import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { RESUME_BILLED_EVENT } from "./event-constants";

export { RESUME_BILLED_EVENT };

export const ResumeBilledPayloadSchema = z.object({
  resumeId: z.string().min(1),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  jobTitle: z.string().min(1),
  description: z.string().optional(),
  billedAt: z.date(),
});

export type IResumeBilledPayload = z.infer<typeof ResumeBilledPayloadSchema>;

@IntegrationEvent({
  type: RESUME_BILLED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted when a resume service is billed",
})
export class ResumeBilledEvent implements IEvent<IResumeBilledPayload> {
  static readonly eventType = RESUME_BILLED_EVENT;
  static readonly schema = ResumeBilledPayloadSchema;

  readonly type = ResumeBilledEvent.eventType;

  constructor(
    public readonly payload: IResumeBilledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IResumeBilledEvent = ResumeBilledEvent;
