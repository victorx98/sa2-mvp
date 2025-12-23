import { z } from "zod";

export interface EventMetadata {
  eventType: string;
  version: string;
  producers: string[];
  consumers: string[];
  schema?: z.ZodSchema;
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

export interface IntegrationEventBase<TPayload = Record<string, unknown>> {
  readonly eventType: string;
  readonly type: string;
  readonly payload: TPayload;
  readonly id?: string;
  readonly timestamp?: number;
  readonly source?: {
    domain?: string;
    service?: string;
  };
}

export interface IntegrationEventMeta {
  id?: string;
  timestamp?: number;
  source?: {
    domain?: string;
    service?: string;
  };
}
