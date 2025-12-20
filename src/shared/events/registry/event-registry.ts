import type { EventMetadata } from "./types";

class EventRegistryClass {
  private readonly registry = new Map<string, EventMetadata>();
  private readonly pendingConsumers = new Map<string, Set<string>>();

  register(meta: EventMetadata): void {
    const existing = this.registry.get(meta.eventType);
    const merged: EventMetadata = existing
      ? {
          ...existing,
          ...meta,
          producers: mergeUnique(existing.producers, meta.producers),
          consumers: mergeUnique(existing.consumers, meta.consumers),
          schema: meta.schema ?? existing.schema,
        }
      : meta;

    const pending = this.pendingConsumers.get(meta.eventType);
    if (pending) {
      merged.consumers = mergeUnique(merged.consumers, Array.from(pending));
      this.pendingConsumers.delete(meta.eventType);
    }

    this.registry.set(meta.eventType, merged);
  }

  get(eventType: string): EventMetadata | undefined {
    return this.registry.get(eventType);
  }

  addConsumer(eventType: string, consumer: string): void {
    const meta = this.registry.get(eventType);
    if (!meta) {
      const set = this.pendingConsumers.get(eventType) ?? new Set<string>();
      set.add(consumer);
      this.pendingConsumers.set(eventType, set);
      return;
    }

    if (!meta.consumers.includes(consumer)) {
      meta.consumers.push(consumer);
    }
  }

  getAll(): EventMetadata[] {
    return Array.from(this.registry.values()).sort((a, b) =>
      a.eventType.localeCompare(b.eventType),
    );
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

  getUnproduced(): EventMetadata[] {
    return this.getAll().filter((event) => event.producers.length === 0);
  }

  getPendingConsumerDeclarations(): Array<{ eventType: string; consumers: string[] }> {
    return Array.from(this.pendingConsumers.entries())
      .map(([eventType, consumers]) => ({
        eventType,
        consumers: Array.from(consumers).sort(),
      }))
      .sort((a, b) => a.eventType.localeCompare(b.eventType));
  }
}

function mergeUnique(left: string[], right: string[]): string[] {
  const set = new Set<string>();
  for (const value of left) set.add(value);
  for (const value of right) set.add(value);
  return Array.from(set);
}

export const EventRegistry = new EventRegistryClass();

