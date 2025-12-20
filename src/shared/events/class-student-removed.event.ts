import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { CLASS_STUDENT_REMOVED_EVENT } from "./event-constants";

export { CLASS_STUDENT_REMOVED_EVENT };

export const ClassStudentRemovedPayloadSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  startDate: z.date(),
  endDate: z.date(),
  description: z.string().optional(),
  studentId: z.string().min(1),
  operatedAt: z.date(),
  refundQuantity: z.number().int().positive().optional(),
});

export type IClassStudentRemovedPayload = z.infer<typeof ClassStudentRemovedPayloadSchema>;

@IntegrationEvent({
  type: CLASS_STUDENT_REMOVED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted when a student is removed from a class",
})
export class ClassStudentRemovedEvent
  implements IEvent<IClassStudentRemovedPayload>
{
  static readonly eventType = CLASS_STUDENT_REMOVED_EVENT;
  static readonly schema = ClassStudentRemovedPayloadSchema;

  readonly type = ClassStudentRemovedEvent.eventType;

  constructor(
    public readonly payload: IClassStudentRemovedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IClassStudentRemovedEvent = ClassStudentRemovedEvent;
