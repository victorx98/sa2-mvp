import { EventRegistry } from "@shared/events/registry";

// Populate registry with all integration events
import "@shared/events";

// Populate registry with all consumer declarations (@HandlesEvent)
import "@shared/events/governance/load-consumers";

describe("Event Governance", () => {
  it("registers all declared consumers against known events", () => {
    const pending = EventRegistry.getPendingConsumerDeclarations();

    if (pending.length > 0) {
      const list = pending
        .map(({ eventType, consumers }) => `- ${eventType}: ${consumers.join(", ")}`)
        .join("\n");
      throw new Error(`Found consumers for unknown events:\n${list}`);
    }
  });

  it("declares at least one producer for every event", () => {
    const unproduced = EventRegistry.getUnproduced();

    if (unproduced.length > 0) {
      const list = unproduced.map((e) => `- ${e.eventType}`).join("\n");
      throw new Error(`Found events with no producers:\n${list}`);
    }
  });

  it("declares at least one consumer for every event", () => {
    const orphans = EventRegistry.getOrphans();

    if (orphans.length > 0) {
      const list = orphans
        .map((e) => `- ${e.eventType} (producers: ${e.producers.join(", ") || "-"})`)
        .join("\n");
      throw new Error(`Found events with no consumers:\n${list}`);
    }
  });
});

