import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { SERVICE_SESSION_COMPLETED_EVENT } from "./event-constants";

export { SERVICE_SESSION_COMPLETED_EVENT };

export const ServiceSessionCompletedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  refrenceId: z.string().min(1).optional(),
  serviceTypeCode: z.string().min(1),
  actualDurationMinutes: z.number().nonnegative(),
  durationMinutes: z.number().positive(),
  allowBilling: z.boolean(),
  sessionTypeCode: z.string().min(1),
});

export type ServiceSessionCompletedPayload = z.infer<
  typeof ServiceSessionCompletedPayloadSchema
>;

@IntegrationEvent({
  type: SERVICE_SESSION_COMPLETED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description:
    "Emitted when a service session reaches a terminal state and should trigger contract consumption and billing",
})
export class ServiceSessionCompletedEvent
  implements IEvent<ServiceSessionCompletedPayload>
{
  static readonly eventType = SERVICE_SESSION_COMPLETED_EVENT;
  static readonly schema = ServiceSessionCompletedPayloadSchema;

  readonly type = ServiceSessionCompletedEvent.eventType;

  constructor(
    public readonly payload: ServiceSessionCompletedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IServiceSessionCompletedPayload = ServiceSessionCompletedPayload;
export type IServiceSessionCompletedEvent = ServiceSessionCompletedEvent;
