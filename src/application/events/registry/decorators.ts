import "reflect-metadata";
import { EventRegistry } from "./event-registry";
import { ProducerDeclaration } from "./types";

export function IntegrationEvent(meta: ProducerDeclaration) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const schema = (constructor as any).schema;

    EventRegistry.register({
      eventType: meta.type,
      version: meta.version,
      producers: meta.producers,
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
