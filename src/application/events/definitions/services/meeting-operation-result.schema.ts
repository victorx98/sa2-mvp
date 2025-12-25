import { z } from "zod";
import { DateTimeSchema } from "../schema-utils";

export const MeetingOperationResultPayloadSchema = z
  .object({
    operation: z.enum(["create", "update", "cancel"]),
    status: z.enum(["success", "failed"]),
    sessionId: z.string(),
    meetingId: z.string().optional().nullable(),
    studentId: z.string().optional(),
    mentorId: z.string().optional().nullable(),
    counselorId: z.string().optional().nullable(),
    createdByCounselorId: z.string().optional().nullable(), // For comm-session
    scheduledAt: DateTimeSchema.optional(),
    duration: z.number().int().positive().optional(),
    meetingUrl: z.string().optional(),
    meetingProvider: z.string().optional(),
    newScheduledAt: DateTimeSchema.optional(),
    newDuration: z.number().int().positive().optional(),
    cancelledAt: DateTimeSchema.optional(),
    cancelReason: z.string().optional(),
    errorMessage: z.string().optional(),
    notifyRoles: z.array(z.string()).optional(),
    requireManualIntervention: z.boolean().optional(),
  })
  .passthrough();

export type MeetingOperationResultPayload = z.infer<
  typeof MeetingOperationResultPayloadSchema
>;
