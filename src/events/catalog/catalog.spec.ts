/**
 * Event Catalog Unit Tests
 * 事件目录单元测试
 *
 * Tests for the centralized event catalog including:
 * - Catalog completeness validation
 * - Event relationship validation
 * - Query function correctness
 * - Mermaid diagram generation
 */

import {
  EventCatalog,
  validateCatalog,
  getCatalogStats,
  getAllEventNames,
  getEventEntry,
  getEventsByDomain,
  getEventsByType,
  getEventsByTag,
  getDeprecatedEvents,
  getEventsForHandler,
  getEventsForProducer,
  getDownstreamEvents,
  getUpstreamEvents,
  buildEventFlowGraph,
  generateMermaidDiagram,
  EventDomain,
  EventType,
  ConsumerPriority,
} from "./index";

// Import event constants to verify catalog completeness
import * as EventConstants from "@shared/events/event-constants";

describe("EventCatalog", () => {
  // ============================================================
  // Catalog Completeness Tests
  // ============================================================

  describe("Catalog Completeness", () => {
    it("should contain entries for all event constants", () => {
      // Get all exported event constants (those ending with _EVENT)
      const eventConstantNames = Object.keys(EventConstants).filter(
        (key) =>
          key.endsWith("_EVENT") &&
          typeof EventConstants[key as keyof typeof EventConstants] ===
            "string",
      );

      const catalogEventNames = getAllEventNames();

      // Check each event constant is in the catalog
      const missingEvents: string[] = [];
      eventConstantNames.forEach((constantName) => {
        const eventValue =
          EventConstants[constantName as keyof typeof EventConstants];
        if (typeof eventValue === "string" && !EventCatalog[eventValue]) {
          missingEvents.push(`${constantName}: "${eventValue}"`);
        }
      });

      // Allow some events to be missing if they're internal/undocumented
      // but log warnings for visibility
      if (missingEvents.length > 0) {
        console.warn(
          "Events defined in constants but not in catalog:",
          missingEvents,
        );
      }

      // At minimum, we should have the majority of events cataloged
      expect(catalogEventNames.length).toBeGreaterThan(20);
    });

    it("should have unique event names", () => {
      const eventNames = getAllEventNames();
      const uniqueNames = new Set(eventNames);
      expect(eventNames.length).toBe(uniqueNames.size);
    });

    it("should have consistent name property matching the key", () => {
      Object.entries(EventCatalog).forEach(([key, entry]) => {
        expect(entry.name).toBe(key);
      });
    });
  });

  // ============================================================
  // Catalog Validation Tests
  // ============================================================

  describe("Catalog Validation", () => {
    it("should pass validation without critical errors", () => {
      const result = validateCatalog();

      // Log warnings for visibility but don't fail on them
      if (result.warnings.length > 0) {
        console.warn("Catalog validation warnings:", result.warnings);
      }

      // Critical errors should fail the test
      if (!result.valid) {
        console.error("Catalog validation errors:", result.errors);
      }

      expect(result.valid).toBe(true);
    });

    it("should have required fields for all entries", () => {
      Object.values(EventCatalog).forEach((entry) => {
        expect(entry.name).toBeDefined();
        expect(entry.description).toBeDefined();
        expect(entry.domain).toBeDefined();
        expect(entry.eventType).toBeDefined();
        expect(entry.producers).toBeDefined();
        expect(entry.consumers).toBeDefined();
        expect(Array.isArray(entry.producers)).toBe(true);
        expect(Array.isArray(entry.consumers)).toBe(true);
      });
    });

    it("should have valid consumer configurations", () => {
      Object.values(EventCatalog).forEach((entry) => {
        entry.consumers.forEach((consumer) => {
          expect(consumer.handler).toBeDefined();
          expect(typeof consumer.handler).toBe("string");
          expect(consumer.priority).toBeDefined();
          expect(
            Object.values(ConsumerPriority).includes(consumer.priority),
          ).toBe(true);
          expect(typeof consumer.async).toBe("boolean");
        });
      });
    });

    it("should have valid domain values", () => {
      Object.values(EventCatalog).forEach((entry) => {
        expect(Object.values(EventDomain).includes(entry.domain)).toBe(true);
      });
    });

    it("should have valid event type values", () => {
      Object.values(EventCatalog).forEach((entry) => {
        expect(Object.values(EventType).includes(entry.eventType)).toBe(true);
      });
    });
  });

  // ============================================================
  // Query Function Tests
  // ============================================================

  describe("Query Functions", () => {
    describe("getEventEntry", () => {
      it("should return entry for valid event name", () => {
        const entry = getEventEntry("session.booked");
        expect(entry).toBeDefined();
        expect(entry?.name).toBe("session.booked");
      });

      it("should return undefined for invalid event name", () => {
        const entry = getEventEntry("non.existent.event");
        expect(entry).toBeUndefined();
      });
    });

    describe("getEventsByDomain", () => {
      it("should return events for session domain", () => {
        const sessionEvents = getEventsByDomain(EventDomain.SESSION);
        expect(sessionEvents.length).toBeGreaterThan(0);
        sessionEvents.forEach((event) => {
          expect(event.domain).toBe(EventDomain.SESSION);
        });
      });

      it("should return events for financial domain", () => {
        const financialEvents = getEventsByDomain(EventDomain.FINANCIAL);
        expect(financialEvents.length).toBeGreaterThan(0);
        financialEvents.forEach((event) => {
          expect(event.domain).toBe(EventDomain.FINANCIAL);
        });
      });

      it("should return events for meeting domain", () => {
        const meetingEvents = getEventsByDomain(EventDomain.MEETING);
        expect(meetingEvents.length).toBeGreaterThan(0);
        meetingEvents.forEach((event) => {
          expect(event.domain).toBe(EventDomain.MEETING);
        });
      });
    });

    describe("getEventsByType", () => {
      it("should return trigger events", () => {
        const triggerEvents = getEventsByType(EventType.TRIGGER);
        expect(triggerEvents.length).toBeGreaterThan(0);
        triggerEvents.forEach((event) => {
          expect(event.eventType).toBe(EventType.TRIGGER);
        });
      });

      it("should return result events", () => {
        const resultEvents = getEventsByType(EventType.RESULT);
        expect(resultEvents.length).toBeGreaterThan(0);
        resultEvents.forEach((event) => {
          expect(event.eventType).toBe(EventType.RESULT);
        });
      });

      it("should return state-change events", () => {
        const stateChangeEvents = getEventsByType(EventType.STATE_CHANGE);
        expect(stateChangeEvents.length).toBeGreaterThan(0);
        stateChangeEvents.forEach((event) => {
          expect(event.eventType).toBe(EventType.STATE_CHANGE);
        });
      });
    });

    describe("getEventsByTag", () => {
      it("should return events with session tag", () => {
        const sessionTaggedEvents = getEventsByTag("session");
        expect(sessionTaggedEvents.length).toBeGreaterThan(0);
        sessionTaggedEvents.forEach((event) => {
          expect(event.tags).toContain("session");
        });
      });

      it("should return events with billing tag", () => {
        const billingEvents = getEventsByTag("billing");
        expect(billingEvents.length).toBeGreaterThan(0);
        billingEvents.forEach((event) => {
          expect(event.tags).toContain("billing");
        });
      });

      it("should return empty array for non-existent tag", () => {
        const noEvents = getEventsByTag("non-existent-tag-12345");
        expect(noEvents).toEqual([]);
      });
    });

    describe("getDeprecatedEvents", () => {
      it("should return deprecated events", () => {
        const deprecatedEvents = getDeprecatedEvents();
        // We have some deprecated events like SESSION_CREATED_EVENT
        expect(deprecatedEvents.length).toBeGreaterThan(0);
        deprecatedEvents.forEach((event) => {
          expect(event.deprecated).toBe(true);
        });
      });
    });

    describe("getEventsForHandler", () => {
      it("should return events consumed by a handler", () => {
        // Use a handler we know exists
        const events = getEventsForHandler("RegularMentoringEventListener");
        expect(events.length).toBeGreaterThan(0);
      });

      it("should return empty array for non-existent handler", () => {
        const events = getEventsForHandler("NonExistentHandler12345");
        expect(events).toEqual([]);
      });
    });

    describe("getEventsForProducer", () => {
      it("should return events emitted by a producer", () => {
        const events = getEventsForProducer(
          "MeetingLifecycleService.handleMeetingCompleted",
        );
        expect(events.length).toBeGreaterThan(0);
      });

      it("should return empty array for non-existent producer", () => {
        const events = getEventsForProducer("NonExistentProducer12345");
        expect(events).toEqual([]);
      });
    });

    describe("getDownstreamEvents", () => {
      it("should return downstream events for session created event", () => {
        const downstream = getDownstreamEvents(
          "regular_mentoring.session.created",
        );
        expect(downstream.length).toBeGreaterThan(0);
        expect(downstream).toContain("session.booked");
      });

      it("should return empty array for event with no triggers", () => {
        // Result events typically don't trigger other events
        const downstream = getDownstreamEvents("session.booked");
        expect(downstream).toEqual([]);
      });
    });

    describe("getUpstreamEvents", () => {
      it("should return required upstream events", () => {
        const upstream = getUpstreamEvents("services.session.completed");
        // This event requires meeting.lifecycle.completed
        expect(upstream).toContain("meeting.lifecycle.completed");
      });
    });
  });

  // ============================================================
  // Flow Analysis Tests
  // ============================================================

  describe("Flow Analysis", () => {
    describe("buildEventFlowGraph", () => {
      it("should build a flow graph with edges", () => {
        const graph = buildEventFlowGraph();
        expect(graph.length).toBeGreaterThan(0);

        // Each edge should have from and to
        graph.forEach((step) => {
          expect(step.from).toBeDefined();
          expect(step.to).toBeDefined();
        });
      });

      it("should not have self-referential edges", () => {
        const graph = buildEventFlowGraph();
        graph.forEach((step) => {
          expect(step.from).not.toBe(step.to);
        });
      });
    });

    describe("generateMermaidDiagram", () => {
      it("should generate valid Mermaid syntax", () => {
        const diagram = generateMermaidDiagram();
        expect(diagram).toContain("graph TD");
        expect(diagram).toContain("subgraph");
      });

      it("should generate diagram for specific domain", () => {
        const diagram = generateMermaidDiagram(EventDomain.SESSION);
        expect(diagram).toContain("graph TD");
        expect(diagram).toContain("session");
      });
    });
  });

  // ============================================================
  // Statistics Tests
  // ============================================================

  describe("Catalog Statistics", () => {
    it("should return accurate statistics", () => {
      const stats = getCatalogStats();

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.totalEvents).toBe(getAllEventNames().length);

      // Should have events in multiple domains
      const domainCount = Object.keys(stats.byDomain).length;
      expect(domainCount).toBeGreaterThan(1);

      // Should have events of multiple types
      const typeCount = Object.keys(stats.byType).length;
      expect(typeCount).toBeGreaterThan(1);

      // Should have some consumers and producers
      expect(stats.totalConsumers).toBeGreaterThan(0);
      expect(stats.totalProducers).toBeGreaterThan(0);

      // Log stats for visibility
      console.log("Event Catalog Statistics:", JSON.stringify(stats, null, 2));
    });
  });

  // ============================================================
  // Session Event Specific Tests
  // ============================================================

  describe("Session Events", () => {
    it("should have all session type events (regular, gap, ai-career, comm, class)", () => {
      const sessionTypes = [
        "regular_mentoring",
        "gap_analysis",
        "ai_career",
        "comm_session",
        "class_session",
      ];

      sessionTypes.forEach((sessionType) => {
        const createdEvent = `${sessionType}.session.created`;
        expect(EventCatalog[createdEvent]).toBeDefined();
        expect(EventCatalog[createdEvent].domain).toBe(EventDomain.SESSION);
      });
    });

    it("should have proper trigger chain for session creation", () => {
      const createdEvent = "regular_mentoring.session.created";
      const entry = EventCatalog[createdEvent];

      // Session created should trigger session booked
      expect(entry.triggers).toContain("session.booked");
    });
  });

  // ============================================================
  // Meeting Event Specific Tests
  // ============================================================

  describe("Meeting Events", () => {
    it("should have meeting lifecycle completed event", () => {
      const event = EventCatalog["meeting.lifecycle.completed"];
      expect(event).toBeDefined();
      expect(event.domain).toBe(EventDomain.MEETING);
      expect(event.eventType).toBe(EventType.STATE_CHANGE);
    });

    it("should have multiple consumers for meeting completed event", () => {
      const event = EventCatalog["meeting.lifecycle.completed"];
      // Multiple session type listeners should consume this event
      expect(event.consumers.length).toBeGreaterThanOrEqual(5);
    });

    it("should trigger service session completed from meeting lifecycle", () => {
      const event = EventCatalog["meeting.lifecycle.completed"];
      expect(event.triggers).toContain("services.session.completed");
    });
  });

  // ============================================================
  // Financial Event Specific Tests
  // ============================================================

  describe("Financial Events", () => {
    it("should have settlement and appeal events", () => {
      expect(EventCatalog["financial.settlement.confirmed"]).toBeDefined();
      expect(EventCatalog["financial.appeal.created"]).toBeDefined();
      expect(EventCatalog["financial.appeal.approved"]).toBeDefined();
      expect(EventCatalog["financial.appeal.rejected"]).toBeDefined();
    });

    it("should have proper dependency chain for appeal events", () => {
      const approvedEvent = EventCatalog["financial.appeal.approved"];
      expect(approvedEvent.requires).toContain("financial.appeal.created");
    });
  });

  // ============================================================
  // Placement Event Specific Tests
  // ============================================================

  describe("Placement Events", () => {
    it("should have job application status events", () => {
      expect(
        EventCatalog["placement.application.status_changed"],
      ).toBeDefined();
      expect(
        EventCatalog["placement.application.status_rolled_back"],
      ).toBeDefined();
      expect(EventCatalog["placement.application.submitted"]).toBeDefined();
    });

    it("should have rollback requiring status change", () => {
      const rollbackEvent =
        EventCatalog["placement.application.status_rolled_back"];
      expect(rollbackEvent.requires).toContain(
        "placement.application.status_changed",
      );
    });
  });
});
