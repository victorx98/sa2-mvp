import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { ServiceHoldExpiryTask } from "./hold-cleanup.task";
import { ServiceHoldService } from "../services/service-hold.service";
import { ContractException } from "../common/exceptions/contract.exception";

describe("ServiceHoldExpiryTask", () => {
  let task: ServiceHoldExpiryTask;
  let serviceHoldService: jest.Mocked<ServiceHoldService>;
  let logger: jest.Mocked<Logger>;

  const mockLogger = {
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const mockServiceHoldService = {
      releaseExpiredHolds: jest.fn(),
      getLongUnreleasedHolds: jest.fn(),
      releaseHold: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceHoldExpiryTask,
        {
          provide: ServiceHoldService,
          useValue: mockServiceHoldService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    task = module.get<ServiceHoldExpiryTask>(ServiceHoldExpiryTask);
    serviceHoldService = module.get(ServiceHoldService);
    logger = module.get(Logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleCron", () => {
    it("should log start of cleanup task", async () => {
      // Arrange
      serviceHoldService.releaseExpiredHolds.mockRejectedValue(
        new ContractException("METHOD_DEPRECATED", "This method is deprecated"),
      );

      // Act
      try {
        await task.handleCron();
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(logger.log).toHaveBeenCalledWith(
        "Starting hourly expired holds cleanup task",
      );
    });

    it("should handle deprecated method error gracefully", async () => {
      // Arrange
      serviceHoldService.releaseExpiredHolds.mockRejectedValue(
        new ContractException("METHOD_DEPRECATED", "This method is deprecated"),
      );

      // Act & Assert
      await expect(task.handleCron()).rejects.toThrow(ContractException);
      expect(logger.log).toHaveBeenCalledWith(
        "Starting hourly expired holds cleanup task",
      );
    });
  });

  describe("triggerCleanup", () => {
    it("should manually trigger cleanup and return results", async () => {
      // Arrange
      const expectedResult = {
        releasedCount: 5,
        failedCount: 0,
        skippedCount: 0,
      };
      serviceHoldService.releaseExpiredHolds.mockResolvedValue(expectedResult);

      // Act
      const result = await task.triggerCleanup();

      // Assert
      expect(serviceHoldService.releaseExpiredHolds).toHaveBeenCalledWith(100);
      expect(result).toEqual(expectedResult);
      expect(logger.log).toHaveBeenCalledWith(
        "Manual trigger: releasing expired holds (batchSize: 100)",
      );
      expect(logger.log).toHaveBeenCalledWith(
        "Manual cleanup completed: released=5, failed=0, skipped=0",
      );
    });

    it("should handle errors in manual cleanup", async () => {
      // Arrange
      const error = new ContractException(
        "METHOD_DEPRECATED",
        "This method is deprecated",
      );
      serviceHoldService.releaseExpiredHolds.mockRejectedValue(error);

      // Act & Assert
      await expect(task.triggerCleanup()).rejects.toThrow(error);
    });

    it("should use custom batch size when provided", async () => {
      // Arrange
      const expectedResult = {
        releasedCount: 10,
        failedCount: 0,
        skippedCount: 0,
      };
      serviceHoldService.releaseExpiredHolds.mockResolvedValue(expectedResult);

      // Act
      const result = await task.triggerCleanup(50);

      // Assert
      expect(serviceHoldService.releaseExpiredHolds).toHaveBeenCalledWith(50);
      expect(result).toEqual(expectedResult);
      expect(logger.log).toHaveBeenCalledWith(
        "Manual trigger: releasing expired holds (batchSize: 50)",
      );
    });
  });

  describe("getLongUnreleasedHolds", () => {
    it("should get long unreleased holds", async () => {
      // Arrange
      const mockHolds = [
        { id: "hold1", status: "active" },
        { id: "hold2", status: "active" },
      ];
      serviceHoldService.getLongUnreleasedHolds.mockResolvedValue(
        mockHolds as any,
      );

      // Act
      const result = await serviceHoldService.getLongUnreleasedHolds(24);

      // Assert
      expect(serviceHoldService.getLongUnreleasedHolds).toHaveBeenCalledWith(
        24,
      );
      expect(result).toEqual(mockHolds);
    });

    it("should handle errors when getting long unreleased holds", async () => {
      // Arrange
      const error = new Error("Database error");
      serviceHoldService.getLongUnreleasedHolds.mockRejectedValue(error);

      // Act & Assert
      await expect(serviceHoldService.getLongUnreleasedHolds()).rejects.toThrow(
        error,
      );
    });
  });

  describe("releaseHold", () => {
    it("should release a hold successfully", async () => {
      // Arrange
      const holdId = "hold1";
      const reason = "Test release";
      const mockReleasedHold = {
        id: holdId,
        status: "released",
        releaseReason: reason,
      };
      serviceHoldService.releaseHold.mockResolvedValue(mockReleasedHold as any);

      // Act
      const result = await serviceHoldService.releaseHold(holdId, reason);

      // Assert
      expect(serviceHoldService.releaseHold).toHaveBeenCalledWith(
        holdId,
        reason,
      );
      expect(result).toEqual(mockReleasedHold);
    });

    it("should handle errors when releasing a hold", async () => {
      // Arrange
      const holdId = "nonexistent";
      const reason = "Test release";
      const error = new Error("Hold not found");
      serviceHoldService.releaseHold.mockRejectedValue(error);

      // Act & Assert
      await expect(
        serviceHoldService.releaseHold(holdId, reason),
      ).rejects.toThrow(error);
    });
  });
});
