import { z } from "zod";
import type { IEvent } from "./event.types";
import { IntegrationEvent } from "./registry";
import { CLASS_STUDENT_ADDED_EVENT } from "./event-constants";

export { CLASS_STUDENT_ADDED_EVENT };

export const ClassStudentAddedPayloadSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  startDate: z.date(),
  endDate: z.date(),
  description: z.string().optional(),
  studentId: z.string().min(1),
  operatedAt: z.date(),
  deductionQuantity: z.number().int().positive().optional(),
});

export type IClassStudentAddedPayload = z.infer<typeof ClassStudentAddedPayloadSchema>;

@IntegrationEvent({
  type: CLASS_STUDENT_ADDED_EVENT,
  version: "1.0",
  producers: ["ServicesModule"],
  description: "Emitted when a student is added to a class",
})
export class ClassStudentAddedEvent implements IEvent<IClassStudentAddedPayload> {
  static readonly eventType = CLASS_STUDENT_ADDED_EVENT;
  static readonly schema = ClassStudentAddedPayloadSchema;

  readonly type = ClassStudentAddedEvent.eventType;

  constructor(
    public readonly payload: IClassStudentAddedPayload,
    public readonly source?: IEvent<unknown>["source"],
    public readonly id?: string,
    public readonly timestamp?: number,
  ) {}
}

export type IClassStudentAddedEvent = ClassStudentAddedEvent;
