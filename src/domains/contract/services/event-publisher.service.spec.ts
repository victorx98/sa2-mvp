import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { EventPublisherService, IEventPublisher } from "./event-publisher.service";
import { DrizzleDatabase } from "@shared/types/database.types";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

describe("EventPublisherService", () => {
  let service: EventPublisherService;
  let db: jest.Mocked<DrizzleDatabase>;
  let eventPublisher: jest.Mocked<IEventPublisher>;
  let logger: jest.Mocked<Logger>;

  const mockLogger = {
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    };

    const mockEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisherService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: "EVENT_PUBLISHER",
          useValue: mockEventPublisher,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<EventPublisherService>(EventPublisherService);
    db = module.get(DATABASE_CONNECTION);
    eventPublisher = module.get("EVENT_PUBLISHER");
    logger = module.get(Logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("processPendingEvents", () => {
    it("should process pending events successfully", async () => {
      // Arrange
      const events = [
        {
          id: "1",
          eventType: "ContractCreated",
          eventData: {},
          status: "pending",
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
        },
        {
          id: "2",
          eventType: "ContractUpdated",
          eventData: {},
          status: "pending",
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
        },
      ];

      // Mock database lock query
      const mockLockQuery = {
        rows: [{ locked: true }],
      };
      db.execute = jest.fn().mockResolvedValue(mockLockQuery as any);

      // Mock database select query
      const mockSelectQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(events),
      };
      db.select = jest.fn().mockReturnValue(mockSelectQuery as any);

      // Mock database update query
      const mockUpdateQuery = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      db.update = jest.fn().mockReturnValue(mockUpdateQuery as any);

      // Mock event publisher
      eventPublisher.publish = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.processPendingEvents();

      // Assert
      expect(result).toBe(events.length);
      expect(eventPublisher.publish).toHaveBeenCalledTimes(events.length);
      expect(mockLogger.log).toHaveBeenCalledWith(
        `Processing ${events.length} pending events`,
      );
    });

    it("should handle publishing errors gracefully", async () => {
      // Arrange
      const events = [
        {
          id: "1",
          eventType: "ContractCreated",
          eventData: {},
          status: "pending",
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
        },
      ];

      // Mock database lock query
      const mockLockQuery = {
        rows: [{ locked: true }],
      };
      db.execute = jest.fn().mockResolvedValue(mockLockQuery as any);

      // Mock database select query
      const mockSelectQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(events),
      };
      db.select = jest.fn().mockReturnValue(mockSelectQuery as any);

      // Mock database update query
      const mockUpdateQuery = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      db.update = jest.fn().mockReturnValue(mockUpdateQuery as any);

      // Mock event publisher to throw error
      const error = new Error("Publishing failed");
      eventPublisher.publish = jest.fn().mockRejectedValue(error);

      // Act
      const result = await service.processPendingEvents();

      // Assert
      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to publish event"),
      );
    });

    it("should skip processing when lock cannot be acquired", async () => {
      // Arrange
      const mockLockQuery = {
        rows: [{ locked: false }],
      };
      db.execute = jest.fn().mockResolvedValue(mockLockQuery as any);

      // Act
      const result = await service.processPendingEvents();

      // Assert
      expect(result).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Another instance is processing events, skipping...(另一个实例正在处理事件，跳过...)",
      );
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const error = new Error("Database error");
      db.execute = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(service.processPendingEvents()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error processing pending events"),
      );
    });
  });

  describe("retryFailedEvents", () => {
    it("should retry failed events successfully", async () => {
      // Arrange
      const events = [
        {
          id: "1",
          eventType: "ContractCreated",
          eventData: {},
          status: "failed",
          retryCount: 3,
          maxRetries: 3,
          createdAt: new Date(),
        },
      ];

      // Mock database update query
      const mockUpdateQuery = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(events),
      };
      db.update = jest.fn().mockReturnValue(mockUpdateQuery as any);

      // Act
      const result = await service.retryFailedEvents();

      // Assert
      expect(result).toBe(events.length);
      expect(logger.log).toHaveBeenCalledWith(
        `Reset ${events.length} failed events for retry`,
      );
    });

    it("should handle retry errors gracefully", async () => {
      // Arrange
      const error = new Error("Retry error");
      db.update = jest.fn().mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(service.retryFailedEvents()).rejects.toThrow(error);
    });
  });

  describe("cleanupOldEvents", () => {
    it("should clean up old events successfully", async () => {
      // Arrange
      const deletedEvents = [{ id: 1 }, { id: 2 }]; // Mock deleted events

      // Mock the delete query
      const mockDeleteQuery = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(deletedEvents),
      };
      db.delete = jest.fn().mockReturnValue(mockDeleteQuery as any);

      // Act
      const result = await service.cleanupOldEvents();

      // Assert
      expect(result).toBe(deletedEvents.length);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(`Cleaned up ${deletedEvents.length} old published events`),
      );
    });

    it("should handle cleanup errors gracefully", async () => {
      // Arrange
      const error = new Error("Cleanup error");
      db.delete = jest.fn().mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(service.cleanupOldEvents()).rejects.toThrow(error);
    });
  });

  describe("getEventStats", () => {
    it("should return event statistics", async () => {
      // Arrange
      const pendingCount = [{ count: 5 }];
      const publishedCount = [{ count: 10 }];
      const failedCount = [{ count: 2 }];

      // Mock the select queries - we need to mock each call separately
      let callCount = 0;
      db.select = jest.fn().mockImplementation(() => {
        callCount++;
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
        };
        
        // Return different results based on call count
        if (callCount === 1) {
          mockQuery.where.mockResolvedValue(pendingCount);
        } else if (callCount === 2) {
          mockQuery.where.mockResolvedValue(publishedCount);
        } else {
          mockQuery.where.mockResolvedValue(failedCount);
        }
        
        return mockQuery;
      });

      // Act
      const result = await service.getEventStats();

      // Assert
      expect(result).toEqual({
        pending: 5,
        published: 10,
        failed: 2,
      });
    });

    it("should handle stats query errors gracefully", async () => {
      // Arrange
      const error = new Error("Stats query error");
      db.select = jest.fn().mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      await expect(service.getEventStats()).rejects.toThrow(error);
    });
  });
});
