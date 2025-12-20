import type { z } from "zod";

export type EventSchema = z.ZodTypeAny;

export interface EventMetadata {
  eventType: string;
  version: string;
  producers: string[];
  consumers: string[];
  schema?: EventSchema;
  description?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
}

export interface ProducerDeclaration {
  type: string;
  version: string;
  producers: string[];
  description?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
}

export interface ConsumerDeclaration {
  eventType: string;
  consumer: string;
}

