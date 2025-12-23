import { EventMetadata } from "./types";

class EventRegistryStore {
  private registry = new Map<string, EventMetadata>();

  register(meta: Omit<EventMetadata, "consumers"> & { consumers?: string[] }): void {
    this.registry.set(meta.eventType, {
      ...meta,
      consumers: meta.consumers ?? [],
    });
  }

  get(eventType: string): EventMetadata | undefined {
    return this.registry.get(eventType);
  }

  addConsumer(eventType: string, consumer: string): void {
    const meta = this.registry.get(eventType);
    if (meta && !meta.consumers.includes(consumer)) {
      meta.consumers.push(consumer);
    }
  }

  getAll(): EventMetadata[] {
    return Array.from(this.registry.values());
  }

  getByProducer(producer: string): EventMetadata[] {
    return this.getAll().filter((event) => event.producers.includes(producer));
  }

  getByConsumer(consumer: string): EventMetadata[] {
    return this.getAll().filter((event) => event.consumers.includes(consumer));
  }

  getOrphans(): EventMetadata[] {
    return this.getAll().filter((event) => event.consumers.length === 0);
  }
}

export const EventRegistry = new EventRegistryStore();
