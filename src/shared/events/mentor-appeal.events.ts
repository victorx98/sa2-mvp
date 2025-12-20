import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  MENTOR_APPEAL_APPROVED_EVENT,
  MENTOR_APPEAL_CREATED_EVENT,
  MENTOR_APPEAL_REJECTED_EVENT,
} from "./event-constants";

export const MentorAppealCreatedPayloadSchema = z.object({
  appealId: z.string().min(1),
  mentorId: z.string().min(1),
  counselorId: z.string().min(1),
  appealAmount: z.string().min(1),
  appealType: z.string().min(1),
  currency: z.string().min(1),
  createdAt: z.date(),
});

export type IMentorAppealCreatedPayload = z.infer<typeof MentorAppealCreatedPayloadSchema>;

@IntegrationEvent({
  type: MENTOR_APPEAL_CREATED_EVENT,
  version: "1.0",
  producers: ["FinancialModule"],
  description: "Emitted when a mentor submits a new appeal",
})
export class MentorAppealCreatedEvent implements IEvent<IMentorAppealCreatedPayload> {
  static readonly eventType = MENTOR_APPEAL_CREATED_EVENT;
  static readonly schema = MentorAppealCreatedPayloadSchema;

  readonly type = MentorAppealCreatedEvent.eventType;

  constructor(
    public readonly payload: IMentorAppealCreatedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IMentorAppealCreatedEvent = MentorAppealCreatedEvent;

export const MentorAppealApprovedPayloadSchema = z.object({
  appealId: z.string().min(1),
  mentorId: z.string().min(1),
  counselorId: z.string().min(1),
  appealAmount: z.string().min(1),
  approvedBy: z.string().min(1),
  approvedAt: z.date(),
  currency: z.string().min(1),
});

export type IMentorAppealApprovedPayload = z.infer<typeof MentorAppealApprovedPayloadSchema>;

@IntegrationEvent({
  type: MENTOR_APPEAL_APPROVED_EVENT,
  version: "1.0",
  producers: ["FinancialModule"],
  description: "Emitted when a counselor approves an appeal",
})
export class MentorAppealApprovedEvent implements IEvent<IMentorAppealApprovedPayload> {
  static readonly eventType = MENTOR_APPEAL_APPROVED_EVENT;
  static readonly schema = MentorAppealApprovedPayloadSchema;

  readonly type = MentorAppealApprovedEvent.eventType;

  constructor(
    public readonly payload: IMentorAppealApprovedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IMentorAppealApprovedEvent = MentorAppealApprovedEvent;

export const MentorAppealRejectedPayloadSchema = z.object({
  appealId: z.string().min(1),
  mentorId: z.string().min(1),
  counselorId: z.string().min(1),
  rejectionReason: z.string().min(1),
  rejectedBy: z.string().min(1),
  rejectedAt: z.date(),
});

export type IMentorAppealRejectedPayload = z.infer<typeof MentorAppealRejectedPayloadSchema>;

@IntegrationEvent({
  type: MENTOR_APPEAL_REJECTED_EVENT,
  version: "1.0",
  producers: ["FinancialModule"],
  description: "Emitted when a counselor rejects an appeal",
})
export class MentorAppealRejectedEvent implements IEvent<IMentorAppealRejectedPayload> {
  static readonly eventType = MENTOR_APPEAL_REJECTED_EVENT;
  static readonly schema = MentorAppealRejectedPayloadSchema;

  readonly type = MentorAppealRejectedEvent.eventType;

  constructor(
    public readonly payload: IMentorAppealRejectedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IMentorAppealRejectedEvent = MentorAppealRejectedEvent;
