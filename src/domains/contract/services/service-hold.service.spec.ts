import { Test, TestingModule } from "@nestjs/testing";
import { ServiceHoldService } from "./service-hold.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";

describe("ServiceHoldService", () => {
  let service: ServiceHoldService;
  let mockDb: any;

  const createMockDb = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    for: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceHoldService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ServiceHoldService>(ServiceHoldService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createHold", () => {
    it("should create hold with expiry when expiryAt is provided", async () => {
      // Arrange
      const now = new Date();
      const expiryAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now (2小时后)
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "counselor-123",
        expiryAt,
      };

      const mockEntitlements = [
        {
          id: "entitlement-1",
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 0,
          availableQuantity: 7,
        },
      ];

      const mockHold = {
        id: "hold-123",
        ...createHoldDto,
        relatedBookingId: null, // Set to null internally
        status: "active",
        createdAt: now,
        expiryAt,
      };

      // Mock database queries
      mockDb.for.mockResolvedValueOnce(mockEntitlements);
      mockDb.returning.mockResolvedValueOnce([mockHold]);

      // Act
      const result = await service.createHold(createHoldDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe("hold-123");
      expect(result.status).toBe("active");
      expect(result.relatedBookingId).toBeNull();
      expect(result.expiryAt).toBe(expiryAt);
      expect(mockDb.for).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should create hold with no expiry when expiryAt is null", async () => {
      // Arrange
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "counselor-123",
        expiryAt: null, // Explicitly set to null (永不过期)
      };

      const mockEntitlements = [
        {
          id: "entitlement-1",
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 0,
          availableQuantity: 7,
        },
      ];

      const mockHold = {
        id: "hold-123",
        ...createHoldDto,
        relatedBookingId: null,
        status: "active",
      };

      // Mock database queries
      mockDb.for.mockResolvedValueOnce(mockEntitlements);
      mockDb.returning.mockResolvedValueOnce([mockHold]);

      // Act
      const result = await service.createHold(createHoldDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe("hold-123");
      expect(result.status).toBe("active");
      expect(result.expiryAt).toBeNull(); // Should be null (永不过期)
      expect(mockDb.for).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should create hold with no expiry when expiryAt is undefined", async () => {
      // Arrange
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "counselor-123",
        // expiryAt is undefined (not provided)
      };

      const mockEntitlements = [
        {
          id: "entitlement-1",
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 0,
          availableQuantity: 7,
        },
      ];

      const mockHold = {
        id: "hold-123",
        ...createHoldDto,
        relatedBookingId: null,
        status: "active",
        expiryAt: null, // Should be null when expiryAt is undefined
      } as any;

      // Mock database queries
      mockDb.for.mockResolvedValueOnce(mockEntitlements);
      mockDb.returning.mockResolvedValueOnce([mockHold]);

      // Act
      const result = await service.createHold(createHoldDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe("hold-123");
      expect(result.status).toBe("active");
      expect(result.expiryAt).toBeNull(); // Should be null (永不过期)
      expect(mockDb.for).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw exception when entitlement not found", async () => {
      // Arrange
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "counselor-123",
      };

      mockDb.for.mockResolvedValueOnce([]); // No entitlements

      // Act & Assert
      await expect(service.createHold(createHoldDto)).rejects.toThrow(
        ContractNotFoundException,
      );
    });

    it("should throw exception when insufficient balance", async () => {
      // Arrange
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 10, // More than available
        createdBy: "counselor-123",
      };

      const mockEntitlements = [
        {
          id: "entitlement-1",
          totalQuantity: 10,
          consumedQuantity: 5,
          heldQuantity: 3,
          availableQuantity: 2, // Only 2 available
        },
      ];

      mockDb.for.mockResolvedValueOnce(mockEntitlements);

      // Act & Assert
      await expect(service.createHold(createHoldDto)).rejects.toThrow(
        ContractException,
      );
    });

    it("should support transaction parameter", async () => {
      // Arrange
      const now = new Date();
      const expiryAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now (2小时后)
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "counselor-123",
        expiryAt,
      };

      const mockTx = createMockDb() as any; // Type assertion to bypass strict typing
      const mockEntitlements = [
        {
          availableQuantity: 5,
        },
      ];

      const mockHold = {
        id: "hold-123",
        ...createHoldDto,
        status: "active",
      };

      mockTx.for.mockResolvedValueOnce(mockEntitlements);
      mockTx.returning.mockResolvedValueOnce([mockHold]);

      // Act
      const result = await service.createHold(createHoldDto, mockTx);

      // Assert
      expect(result).toBeDefined();
      expect(mockTx.for).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
      // Should not call mockDb
      expect(mockDb.for).not.toHaveBeenCalled();
    });
  });

  describe("releaseHold", () => {
    it("should release hold successfully", async () => {
      // Arrange
      const mockHold = {
        id: "hold-123",
        status: "active",
        quantity: 2,
      };

      const mockReleasedHold = {
        ...mockHold,
        status: "released",
        releaseReason: "completed",
        releasedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockHold]);
      mockDb.returning.mockResolvedValueOnce([mockReleasedHold]);

      // Act
      const result = await service.releaseHold("hold-123", "completed");

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("released");
      expect(result.releaseReason).toBe("completed");
    });

    it("should throw exception when hold not found", async () => {
      // Arrange
      mockDb.limit.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(service.releaseHold("non-existent", "test")).rejects.toThrow(
        ContractNotFoundException,
      );
    });

    it("should throw exception when hold not active", async () => {
      // Arrange
      const mockHold = {
        id: "hold-123",
        status: "released", // Already released
      };

      mockDb.limit.mockResolvedValueOnce([mockHold]);

      // Act & Assert
      await expect(service.releaseHold("hold-123", "test")).rejects.toThrow(
        ContractException,
      );
    });
  });

  describe("getActiveHolds", () => {
    it("should return all active holds for contract and service type", async () => {
      // Arrange
      const mockHolds = [
        { id: "hold-1", status: "active", quantity: 1 },
        { id: "hold-2", status: "active", quantity: 2 },
      ];

      mockDb.where.mockResolvedValueOnce(mockHolds);

      // Act
      const result = await service.getActiveHolds(
        "contract-123",
        "resume_review",
      );

      // Assert
      expect(result).toEqual(mockHolds);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should return empty array when no active holds", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([]);

      // Act
      const result = await service.getActiveHolds(
        "contract-123",
        "resume_review",
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("cancelHold", () => {
    it("should cancel hold successfully", async () => {
      // Arrange
      const mockHold = {
        id: "hold-123",
        status: "active",
      };

      const mockCancelledHold = {
        ...mockHold,
        status: "released",
        releaseReason: "booking_cancelled",
        releasedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockHold]);
      mockDb.returning.mockResolvedValueOnce([mockCancelledHold]);

      // Act
      const result = await service.cancelHold("hold-123", "booking_cancelled");

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("released");
      expect(result.releaseReason).toBe("booking_cancelled");
    });

    it("should throw exception when hold not found", async () => {
      // Arrange
      mockDb.limit.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(service.cancelHold("non-existent", "test")).rejects.toThrow(
        ContractNotFoundException,
      );
    });

    it("should throw exception when hold not active", async () => {
      // Arrange
      const mockHold = {
        id: "hold-123",
        status: "expired",
      };

      mockDb.limit.mockResolvedValueOnce([mockHold]);

      // Act & Assert
      await expect(service.cancelHold("hold-123", "test")).rejects.toThrow(
        ContractException,
      );
    });
  });

  describe("updateRelatedBooking", () => {
    it("should update related booking ID successfully", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce(undefined); // update returns undefined

      // Act
      await service.updateRelatedBooking("hold-123", "session-456");

      // Assert
      expect(mockDb.update).toHaveBeenCalledWith(expect.any(Object));
      expect(mockDb.set).toHaveBeenCalledWith({
        relatedBookingId: "session-456",
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should support transaction parameter", async () => {
      // Arrange
      const mockTx = createMockDb() as any;
      mockTx.where = jest.fn().mockResolvedValueOnce(undefined);

      // Act
      await service.updateRelatedBooking("hold-123", "session-456", mockTx);

      // Assert
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.set).toHaveBeenCalled();
      expect(mockTx.where).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled(); // Should use transaction, not main db
    });
  });

  describe('releaseExpiredHolds', () => {
    it('should successfully release expired holds', async () => {
      // Arrange
      const mockExpiredHolds = [
        { id: 'hold-1', status: 'active', expiryAt: new Date('2023-01-01') },
        { id: 'hold-2', status: 'active', expiryAt: new Date('2023-01-01') }
      ];
      
      // Create a fresh mock for this test
      const freshMockDb = createMockDb();
      freshMockDb.limit.mockResolvedValueOnce(mockExpiredHolds);
      
      // For each hold update, we need to mock the update chain
      const updateMock = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValueOnce([{ ...mockExpiredHolds[0], status: 'expired' }])
          .mockResolvedValueOnce([{ ...mockExpiredHolds[1], status: 'expired' }])
      };
      
      freshMockDb.update.mockReturnValue(updateMock);
      
      // Replace the service's db with our fresh mock
      (service as any).db = freshMockDb;

      // Act
      const result = await service.releaseExpiredHolds();

      // Assert
      expect(result).toEqual({
        releasedCount: 2,
        failedCount: 0,
        skippedCount: 0,
      });
    });

    it('should return zero when no expired holds found', async () => {
      // Arrange
      const freshMockDb = createMockDb();
      freshMockDb.limit.mockResolvedValueOnce([]);
      
      // Replace the service's db with our fresh mock
      (service as any).db = freshMockDb;

      // Act
      const result = await service.releaseExpiredHolds();

      // Assert
      expect(result).toEqual({
        releasedCount: 0,
        failedCount: 0,
        skippedCount: 1, // Skipped because no expired holds found
      });
    });

    it('should handle errors during release process', async () => {
      // Arrange
      const mockExpiredHolds = [
        { id: 'hold-1', status: 'active', expiryAt: new Date('2023-01-01') }
      ];
      
      // Create a mock that will throw an error on update
      const mockDbWithError = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce(mockExpiredHolds),
        update: jest.fn().mockImplementation(() => {
          throw new Error('Database error');
        })
      };
      
      // Replace the service's db with our error-prone mock
      (service as any).db = mockDbWithError;
      
      // Mock console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Act
      const result = await service.releaseExpiredHolds();

      // Assert
      expect(result).toEqual({
        releasedCount: 0,
        failedCount: 1,
        skippedCount: 0,
      });
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe("triggerExpiredHoldsRelease", () => {
    it("should trigger release of expired holds", async () => {
      // Arrange
      const mockResult = {
        releasedCount: 5,
        failedCount: 0,
        skippedCount: 0,
      };

      // Mock the releaseExpiredHolds method
      jest.spyOn(service, 'releaseExpiredHolds').mockResolvedValueOnce(mockResult);

      // Act
      const result = await service.triggerExpiredHoldsRelease();

      // Assert
      expect(result).toEqual(mockResult);
      expect(service.releaseExpiredHolds).toHaveBeenCalledTimes(1);
      expect(service.releaseExpiredHolds).toHaveBeenCalledWith(100, "manual-trigger");
    });

    it("should pass batch size parameter correctly", async () => {
      // Arrange
      const mockResult = {
        releasedCount: 3,
        failedCount: 0,
        skippedCount: 0,
      };

      // Mock the releaseExpiredHolds method
      jest.spyOn(service, 'releaseExpiredHolds').mockResolvedValueOnce(mockResult);

      // Act
      const result = await service.triggerExpiredHoldsRelease(50);

      // Assert
      expect(result).toEqual(mockResult);
      expect(service.releaseExpiredHolds).toHaveBeenCalledTimes(1);
      expect(service.releaseExpiredHolds).toHaveBeenCalledWith(50, "manual-trigger");
    });
  });
});
