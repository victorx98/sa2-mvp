import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { v4 as uuidv4 } from "uuid";
import { EventRegistry } from "@shared/events/registry";
import type { IEvent } from "@shared/events";

export class EventSchemaValidationError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly validationErrors: unknown,
  ) {
    super(`Schema validation failed for event: ${eventType}`);
    this.name = "EventSchemaValidationError";
  }
}

export class UnauthorizedProducerError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly producer: string,
  ) {
    super(`${producer} is not authorized to produce ${eventType}`);
    this.name = "UnauthorizedProducerError";
  }
}

export class UnknownEventError extends Error {
  constructor(public readonly eventType: string) {
    super(`Attempted to publish unknown event: ${eventType}`);
    this.name = "UnknownEventError";
  }
}

@Injectable()
export class VerifiedEventBus {
  private readonly logger = new Logger(VerifiedEventBus.name);
  private readonly strictMode: boolean;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.strictMode =
      this.configService.get("EVENT_GOVERNANCE_STRICT") === "true" ||
      this.configService.get("NODE_ENV") === "development";
  }

  publish<TPayload>(event: IEvent<TPayload>, producerModule: string): void {
    const meta = EventRegistry.get(event.type);

    if (!meta) {
      const error = new UnknownEventError(event.type);
      if (this.strictMode) throw error;
      this.logger.error(error.message);
      return;
    }

    if (!meta.producers.includes(producerModule)) {
      const error = new UnauthorizedProducerError(event.type, producerModule);
      if (this.strictMode) throw error;
      this.logger.warn(error.message);
    }

    if (meta.schema) {
      const result = meta.schema.safeParse(event.payload);
      if (!result.success) {
        const error = new EventSchemaValidationError(
          event.type,
          result.error.format(),
        );
        if (this.strictMode) throw error;
        this.logger.error(
          `Schema validation failed for ${event.type}`,
          result.error,
        );
      }
    }

    if (meta.consumers.length === 0) {
      this.logger.warn(
        `Publishing orphan event: ${event.type} (no consumers registered)`,
      );
    }

    const normalized: IEvent<TPayload> = {
      ...event,
      id: event.id ?? uuidv4(),
      timestamp: event.timestamp ?? Date.now(),
    };

    this.eventEmitter.emit(event.type, normalized);
    this.logger.debug(`Published ${event.type} from ${producerModule}`);
  }
}
