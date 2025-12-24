import { z } from "zod";
import { IntegrationEvent } from "../../registry";
import { BaseIntegrationEvent } from "../base-event";
import { DateTimeSchema, UuidSchema } from "../schema-utils";

export const ClassStudentRemovedPayloadSchema = z
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
    refundQuantity: z.number().int().positive().optional(),
  })
  .passthrough();

export type ClassStudentRemovedPayload = z.infer<
  typeof ClassStudentRemovedPayloadSchema
>;

@IntegrationEvent({
  type: "class.student.removed",
  version: "1.0",
  producers: ["TBD"],
  description: "Emitted when a student is removed from a class.",
})
export class ClassStudentRemovedEvent extends BaseIntegrationEvent<ClassStudentRemovedPayload> {
  static readonly eventType = "class.student.removed";
  static readonly schema = ClassStudentRemovedPayloadSchema;
}
