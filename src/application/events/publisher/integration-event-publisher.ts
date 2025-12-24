import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EventRegistry } from "../registry";
import { IntegrationEventBase } from "../registry/types";

@Injectable()
export class IntegrationEventPublisher {
  private readonly logger = new Logger(IntegrationEventPublisher.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish<T extends IntegrationEventBase>(
    event: T,
    producer: string,
  ): Promise<void> {
    const meta = EventRegistry.get(event.eventType);

    if (!meta) {
      this.logger.warn(`Unregistered event: ${event.eventType}`);
    }

    if (meta && !meta.producers.includes(producer)) {
      this.logger.warn(
        `${producer} is not a declared producer of ${event.eventType}`,
      );
    }

    if (meta?.schema) {
      const result = meta.schema.safeParse(event.payload);
      if (!result.success) {
        this.logger.error(
          `Schema validation failed for ${event.eventType}`,
          result.error.format(),
        );
      }
    }

    await this.eventEmitter.emitAsync(event.eventType, event);

    this.logger.debug(`Published ${event.eventType} from ${producer}`);
  }
}
