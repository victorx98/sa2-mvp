import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { RESUME_BILL_CANCELLED_EVENT } from "./event-constants";

export { RESUME_BILL_CANCELLED_EVENT };

export const ResumeBillCancelledPayloadSchema = z.object({
  resumeId: z.string().min(1),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  jobTitle: z.string().min(1),
  description: z.string().optional(),
  cancelledAt: z.date(),
});

export type IResumeBillCancelledPayload = z.infer<
  typeof ResumeBillCancelledPayloadSchema
>;

@IntegrationEvent({
  type: RESUME_BILL_CANCELLED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted when a resume billing is cancelled",
})
export class ResumeBillCancelledEvent
  implements IEvent<IResumeBillCancelledPayload>
{
  static readonly eventType = RESUME_BILL_CANCELLED_EVENT;
  static readonly schema = ResumeBillCancelledPayloadSchema;

  readonly type = ResumeBillCancelledEvent.eventType;

  constructor(
    public readonly payload: IResumeBillCancelledPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IResumeBillCancelledEvent = ResumeBillCancelledEvent;
