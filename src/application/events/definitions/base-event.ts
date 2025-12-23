import { randomUUID } from "crypto";
import { IntegrationEventBase, IntegrationEventMeta } from "../registry/types";

export abstract class BaseIntegrationEvent<TPayload>
  implements IntegrationEventBase<TPayload>
{
  static readonly eventType: string;
  static readonly schema: unknown;

  readonly eventType: string;
  readonly type: string;
  readonly id?: string;
  readonly timestamp?: number;
  readonly source?: {
    domain?: string;
    service?: string;
  };

  constructor(public readonly payload: TPayload, meta: IntegrationEventMeta = {}) {
    const ctor = this.constructor as typeof BaseIntegrationEvent;
    this.eventType = (ctor as any).eventType;
    this.type = this.eventType;
    this.id = meta.id ?? randomUUID();
    this.timestamp = meta.timestamp ?? Date.now();
    this.source = meta.source;
  }
}
