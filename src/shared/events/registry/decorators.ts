import "reflect-metadata";
import { EventRegistry } from "./event-registry";
import type { ProducerDeclaration } from "./types";

export function IntegrationEvent(meta: ProducerDeclaration) {
  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    const schema = (constructor as any).schema;

    EventRegistry.register({
      eventType: meta.type,
      version: meta.version,
      producers: meta.producers,
      consumers: [],
      schema,
      description: meta.description,
      deprecated: meta.deprecated,
      deprecationMessage: meta.deprecationMessage,
    });

    Reflect.defineMetadata("integration-event", meta, constructor);
    return constructor;
  };
}

export function HandlesEvent(eventType: string, consumer: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    EventRegistry.addConsumer(eventType, consumer);

    Reflect.defineMetadata(
      "handles-event",
      { eventType, consumer },
      target,
      propertyKey,
    );

    return descriptor;
  };
}

export function SagaHandlesEvent(eventType: string, consumer: string) {
  return function (constructor: Function) {
    EventRegistry.addConsumer(eventType, consumer);
    Reflect.defineMetadata(
      "saga-handles-event",
      { eventType, consumer },
      constructor,
    );
  };
}

