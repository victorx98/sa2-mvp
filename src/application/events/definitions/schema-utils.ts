import { z } from "zod";

export const UuidSchema = z.string().uuid();
export const DateTimeSchema = z.union([z.string(), z.date()]);
export const NonEmptyStringSchema = z.string().min(1);
