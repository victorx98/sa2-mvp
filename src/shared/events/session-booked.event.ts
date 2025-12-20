import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";

export const SESSION_BOOKED_EVENT = "session.booked";

export const SessionBookedPayloadSchema = z.object({
  sessionId: z.string().min(1),
  counselorId: z.string().min(1),
  studentId: z.string().min(1),
  mentorId: z.string().min(1),
  serviceType: z.string().min(1),
  mentorCalendarSlotId: z.string().min(1),
  studentCalendarSlotId: z.string().min(1),
  serviceHoldId: z.string().min(1),
  scheduledStartTime: z.string().datetime(),
  duration: z.number().int().positive(),
  meetingProvider: z.string().min(1).optional(),
  meetingPassword: z.string().min(1).optional(),
  meetingUrl: z.string().min(1),
});

export type SessionBookedPayload = z.infer<typeof SessionBookedPayloadSchema>;

@IntegrationEvent({
  type: SESSION_BOOKED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted when a session is fully booked (meeting URL ready)",
})
export class SessionBookedEvent implements IEvent<SessionBookedPayload> {
  static readonly eventType = SESSION_BOOKED_EVENT;
  static readonly schema = SessionBookedPayloadSchema;

  readonly type = SessionBookedEvent.eventType;

  constructor(
    public readonly payload: SessionBookedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}
