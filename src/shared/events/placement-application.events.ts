import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  PLACEMENT_APPLICATION_SUBMITTED_EVENT,
} from "./event-constants";

const DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const JobApplicationStatusChangedPayloadSchema = z.object({
  applicationId: z.string().min(1),
  previousStatus: z.string().min(1).nullable().optional(),
  newStatus: z.string().min(1),
  changedBy: z.string().min(1).optional(),
  changedAt: z.string().datetime(),
  changeMetadata: z.record(z.string(), z.unknown()).optional(),
  assignedMentorId: z.string().min(1).optional(),
});

export type IJobApplicationStatusChangedPayload = z.infer<
  typeof JobApplicationStatusChangedPayloadSchema
>;

@IntegrationEvent({
  type: JOB_APPLICATION_STATUS_CHANGED_EVENT,
  version: "1.0",
  producers: ["PlacementModule"],
  description: "Emitted when a job application status transitions to a new state",
})
export class JobApplicationStatusChangedEvent
  implements IEvent<IJobApplicationStatusChangedPayload>
{
  static readonly eventType = JOB_APPLICATION_STATUS_CHANGED_EVENT;
  static readonly schema = JobApplicationStatusChangedPayloadSchema;

  readonly type = JobApplicationStatusChangedEvent.eventType;

  constructor(
    public readonly payload: IJobApplicationStatusChangedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IJobApplicationStatusChangedEvent = JobApplicationStatusChangedEvent;

export const JobApplicationStatusRolledBackPayloadSchema = z.object({
  applicationId: z.string().min(1),
  previousStatus: z.string().min(1),
  newStatus: z.string().min(1),
  changedBy: z.string().min(1),
  changedAt: z.string().datetime(),
  rollbackReason: z.string().min(1),
  assignedMentorId: z.string().min(1).optional(),
});

export type IJobApplicationStatusRolledBackPayload = z.infer<
  typeof JobApplicationStatusRolledBackPayloadSchema
>;

@IntegrationEvent({
  type: JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  version: "1.0",
  producers: ["PlacementModule"],
  description: "Emitted when a job application status is rolled back to a previous state",
})
export class JobApplicationStatusRolledBackEvent
  implements IEvent<IJobApplicationStatusRolledBackPayload>
{
  static readonly eventType = JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT;
  static readonly schema = JobApplicationStatusRolledBackPayloadSchema;

  readonly type = JobApplicationStatusRolledBackEvent.eventType;

  constructor(
    public readonly payload: IJobApplicationStatusRolledBackPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IJobApplicationStatusRolledBackEvent = JobApplicationStatusRolledBackEvent;

export const PlacementApplicationSubmittedPayloadSchema = z.object({
  id: z.string().min(1),
  service_type: z.literal("job_application"),
  student_user_id: z.string().min(1),
  provider_user_id: z.string().min(1),
  consumed_units: z.literal(1),
  unit_type: z.literal("count"),
  completed_time: DateTimeSchema,
  title: z.string().min(1).optional(),
});

export type IPlacementApplicationSubmittedPayload = z.infer<
  typeof PlacementApplicationSubmittedPayloadSchema
>;

@IntegrationEvent({
  type: PLACEMENT_APPLICATION_SUBMITTED_EVENT,
  version: "1.0",
  producers: ["PlacementModule"],
  description:
    "Emitted when a placement application is submitted (for service registry registration)",
})
export class PlacementApplicationSubmittedEvent
  implements IEvent<IPlacementApplicationSubmittedPayload>
{
  static readonly eventType = PLACEMENT_APPLICATION_SUBMITTED_EVENT;
  static readonly schema = PlacementApplicationSubmittedPayloadSchema;

  readonly type = PlacementApplicationSubmittedEvent.eventType;

  constructor(
    public readonly payload: IPlacementApplicationSubmittedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IPlacementApplicationSubmittedEvent = PlacementApplicationSubmittedEvent;
