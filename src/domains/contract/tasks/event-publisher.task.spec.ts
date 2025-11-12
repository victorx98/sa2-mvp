import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { EventPublisherTask } from "./event-publisher.task";
import { EventPublisherService } from "../services/event-publisher.service";

describe("EventPublisherTask", () => {
  let task: EventPublisherTask;
  let eventPublisherService: jest.Mocked<EventPublisherService>;
  let logger: jest.Mocked<Logger>;

  const mockLogger = {
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  beforeEach(async () => {
    const mockEventPublisherService = {
      processPendingEvents: jest.fn(),
      getEventStats: jest.fn(),
      cleanupOldEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisherTask,
        {
          provide: EventPublisherService,
          useValue: mockEventPublisherService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    task = module.get<EventPublisherTask>(EventPublisherTask);
    eventPublisherService = module.get(EventPublisherService);
    logger = module.get(Logger);

    // Replace the task's logger with our mock
    (task as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleEventPublishing", () => {
    it("should process pending events successfully", async () => {
      // Arrange
      const publishedCount = 5;
      eventPublisherService.processPendingEvents.mockResolvedValue(
        publishedCount,
      );

      // Act
      await task.handleEventPublishing();

      // Assert
      expect(eventPublisherService.processPendingEvents).toHaveBeenCalledTimes(
        1,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Starting event publishing task...",
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Published ${publishedCount} events`,
      );
    });

    it("should not log when no events are published", async () => {
      // Arrange
      eventPublisherService.processPendingEvents.mockResolvedValue(0);

      // Act
      await task.handleEventPublishing();

      // Assert
      expect(eventPublisherService.processPendingEvents).toHaveBeenCalledTimes(
        1,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Starting event publishing task...",
      );
      expect(logger.log).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const error = new Error("Test error");
      eventPublisherService.processPendingEvents.mockRejectedValue(error);

      // Act
      await task.handleEventPublishing();

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        "Starting event publishing task...",
      );
      expect(logger.error).toHaveBeenCalledWith(
        `Event publishing task failed: ${error}`,
      );
    });
  });

  describe("handleEventStats", () => {
    it("should log event statistics successfully", async () => {
      // Arrange
      const stats = { pending: 5, published: 10, failed: 2 };
      eventPublisherService.getEventStats.mockResolvedValue(stats);

      // Act
      await task.handleEventStats();

      // Assert
      expect(eventPublisherService.getEventStats).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith(
        `Event statistics: ${stats.pending} pending, ${stats.published} published, ${stats.failed} failed`,
      );
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const error = new Error("Test error");
      eventPublisherService.getEventStats.mockRejectedValue(error);

      // Act
      await task.handleEventStats();

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        `Event stats task failed: ${error}`,
      );
    });
  });

  describe("handleEventCleanup", () => {
    it("should clean up old events successfully", async () => {
      // Arrange
      const deletedCount = 15;
      eventPublisherService.cleanupOldEvents.mockResolvedValue(deletedCount);

      // Act
      await task.handleEventCleanup();

      // Assert
      expect(eventPublisherService.cleanupOldEvents).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith("Starting event cleanup task...");
      expect(logger.log).toHaveBeenCalledWith(
        `Cleaned up ${deletedCount} old events`,
      );
    });

    it("should log debug when no events to clean up", async () => {
      // Arrange
      eventPublisherService.cleanupOldEvents.mockResolvedValue(0);

      // Act
      await task.handleEventCleanup();

      // Assert
      expect(eventPublisherService.cleanupOldEvents).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith("Starting event cleanup task...");
      expect(logger.debug).toHaveBeenCalledWith("No old events to clean up");
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const error = new Error("Test error");
      eventPublisherService.cleanupOldEvents.mockRejectedValue(error);

      // Act
      await task.handleEventCleanup();

      // Assert
      expect(logger.log).toHaveBeenCalledWith("Starting event cleanup task...");
      expect(logger.error).toHaveBeenCalledWith(
        `Event cleanup task failed: ${error}`,
      );
    });
  });
});
