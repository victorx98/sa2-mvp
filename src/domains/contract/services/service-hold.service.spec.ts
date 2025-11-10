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
    it("should create hold successfully when sufficient balance", async () => {
      // Arrange
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        relatedBookingId: "booking-123",
        createdBy: "counselor-123",
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
        status: "active",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
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
      const createHoldDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "counselor-123",
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
});
