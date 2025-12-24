import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const ClassStudentAddedPayloadSchema = z
  .object({
    classId: UuidSchema,
    name: z.string(),
    type: z.string(),
    status: z.string(),
    startDate: DateTimeSchema,
    endDate: DateTimeSchema,
    description: z.string().optional(),
    studentId: UuidSchema,
    operatedAt: DateTimeSchema,
    deductionQuantity: z.number().int().positive().optional(),
  })
  .passthrough();

export type ClassStudentAddedPayload = z.infer<
  typeof ClassStudentAddedPayloadSchema
>;

@IntegrationEvent({
  type: "class.student.added",
  version: "1.0",
  producers: ["TBD"],
  description: "Emitted when a student is added to a class.",
})
export class ClassStudentAddedEvent extends BaseIntegrationEvent<ClassStudentAddedPayload> {
  static readonly eventType = "class.student.added";
  static readonly schema = ClassStudentAddedPayloadSchema;
}
