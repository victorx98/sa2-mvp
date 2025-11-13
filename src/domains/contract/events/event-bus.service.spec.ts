import { Test, TestingModule } from "@nestjs/testing";
import { EventBusService } from "./event-bus.service";
import type { DomainEvent } from "@infrastructure/database/schema";

describe("EventBusService", () => {
  let service: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("publish", () => {
    it("should publish event to subscribers", () => {
      // Arrange
      const eventName = "test.event";
      const eventData = { id: 1, name: "Test Event" };
      const mockHandler = jest.fn();

      // Create a proper DomainEvent object
      const event: DomainEvent = {
        id: "test-id",
        eventType: eventName,
        aggregateId: "test-aggregate-id",
        aggregateType: "Test",
        payload: eventData,
        status: "pending",
        createdAt: new Date(),
        publishedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        errorMessage: null,
        metadata: null,
      };

      service.subscribe(eventName, mockHandler);

      // Act
      service.publish(event);

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    it("should handle multiple subscribers", () => {
      // Arrange
      const eventName = "test.event";
      const eventData = { id: 1, name: "Test Event" };
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();

      // Create a proper DomainEvent object
      const event: DomainEvent = {
        id: "test-id",
        eventType: eventName,
        aggregateId: "test-aggregate-id",
        aggregateType: "Test",
        payload: eventData,
        status: "pending",
        createdAt: new Date(),
        publishedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        errorMessage: null,
        metadata: null,
      };

      service.subscribe(eventName, mockHandler1);
      service.subscribe(eventName, mockHandler2);

      // Act
      service.publish(event);

      // Assert
      expect(mockHandler1).toHaveBeenCalledWith(event);
      expect(mockHandler2).toHaveBeenCalledWith(event);
    });

    it("should not throw when no subscribers exist", () => {
      // Arrange
      const eventName = "test.event";
      const eventData = { id: 1, name: "Test Event" };

      // Create a proper DomainEvent object
      const event: DomainEvent = {
        id: "test-id",
        eventType: eventName,
        aggregateId: "test-aggregate-id",
        aggregateType: "Test",
        payload: eventData,
        status: "pending",
        createdAt: new Date(),
        publishedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        errorMessage: null,
        metadata: null,
      };

      // Act & Assert
      expect(() => service.publish(event)).not.toThrow();
    });
  });

  describe("subscribe", () => {
    it("should add subscriber for event", () => {
      // Arrange
      const eventName = "test.event";
      const mockHandler = jest.fn();

      // Act
      service.subscribe(eventName, mockHandler);

      // Assert
      expect(service.listenerCount(eventName)).toBe(1);
    });

    it("should add multiple subscribers for same event", () => {
      // Arrange
      const eventName = "test.event";
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();

      // Act
      service.subscribe(eventName, mockHandler1);
      service.subscribe(eventName, mockHandler2);

      // Assert
      expect(service.listenerCount(eventName)).toBe(2);
    });
  });

  describe("unsubscribe", () => {
    it("should remove subscriber for event", () => {
      // Arrange
      const eventName = "test.event";
      const mockHandler = jest.fn();
      service.subscribe(eventName, mockHandler);

      // Act
      service.unsubscribe(eventName, mockHandler);

      // Assert
      expect(service.listenerCount(eventName)).toBe(0);
    });

    it("should handle unsubscribe when no subscription exists", () => {
      // Arrange
      const eventName = "test.event";
      const mockHandler = jest.fn();

      // Act & Assert
      expect(() => service.unsubscribe(eventName, mockHandler)).not.toThrow();
      expect(service.listenerCount(eventName)).toBe(0);
    });

    it("should only remove specific subscriber", () => {
      // Arrange
      const eventName = "test.event";
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      service.subscribe(eventName, mockHandler1);
      service.subscribe(eventName, mockHandler2);

      // Act
      service.unsubscribe(eventName, mockHandler1);

      // Assert
      expect(service.listenerCount(eventName)).toBe(1);
    });
  });

  describe("listenerCount", () => {
    it("should return 0 for events with no subscribers", () => {
      // Arrange
      const eventName = "nonexistent.event";

      // Act
      const count = service.listenerCount(eventName);

      // Assert
      expect(count).toBe(0);
    });

    it("should return correct count for events with subscribers", () => {
      // Arrange
      const eventName = "test.event";
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      service.subscribe(eventName, mockHandler1);
      service.subscribe(eventName, mockHandler2);

      // Act
      const count = service.listenerCount(eventName);

      // Assert
      expect(count).toBe(2);
    });
  });
});
