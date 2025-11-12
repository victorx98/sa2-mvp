import { Test, TestingModule } from "@nestjs/testing";
import { ServiceLedgerService } from "./service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";

describe("ServiceLedgerService", () => {
  let service: ServiceLedgerService;
  let mockDb: any;

  const createMockDb = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    execute: jest.fn(),
  });

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceLedgerService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ServiceLedgerService>(ServiceLedgerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("recordConsumption", () => {
    it("should record consumption successfully", async () => {
      // Arrange
      const recordConsumptionDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        sessionId: "session-123",
        createdBy: "system",
      };

      const mockEntitlements = [
        {
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 0,
          availableQuantity: 7,
        },
      ];

      const mockLedger = {
        id: "ledger-123",
        ...recordConsumptionDto,
        quantity: -2,
        type: "consumption",
        source: "booking_completed",
        balanceAfter: 5,
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce(mockEntitlements);
      mockDb.returning.mockResolvedValueOnce([mockLedger]);

      // Act
      const result = await service.recordConsumption(recordConsumptionDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.quantity).toBe(-2);
      expect(result.type).toBe("consumption");
    });

    it("should throw exception when entitlement not found", async () => {
      // Arrange
      const recordConsumptionDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 2,
        createdBy: "system",
      };

      mockDb.where.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        service.recordConsumption(recordConsumptionDto),
      ).rejects.toThrow(ContractNotFoundException);
    });

    it("should throw exception when insufficient balance", async () => {
      // Arrange
      const recordConsumptionDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 10, // More than available
        createdBy: "system",
      };

      const mockEntitlements = [
        {
          availableQuantity: 5, // Only 5 available
        },
      ];

      mockDb.where.mockResolvedValueOnce(mockEntitlements);

      // Act & Assert
      await expect(
        service.recordConsumption(recordConsumptionDto),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("recordAdjustment", () => {
    it("should record positive adjustment successfully", async () => {
      // Arrange
      const recordAdjustmentDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 3, // Add 3 sessions
        reason: "Compensation for service issue",
        createdBy: "admin-123",
      };

      const mockEntitlements = [
        {
          availableQuantity: 5,
        },
      ];

      const mockLedger = {
        id: "ledger-123",
        ...recordAdjustmentDto,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter: 8,
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce(mockEntitlements);
      mockDb.returning.mockResolvedValueOnce([mockLedger]);

      // Act
      const result = await service.recordAdjustment(recordAdjustmentDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.quantity).toBe(3);
      expect(result.type).toBe("adjustment");
      expect(result.balanceAfter).toBe(8);
    });

    it("should record negative adjustment successfully", async () => {
      // Arrange
      const recordAdjustmentDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: -2, // Deduct 2 sessions
        reason: "Error correction",
        createdBy: "admin-123",
      };

      const mockEntitlements = [
        {
          availableQuantity: 5,
        },
      ];

      const mockLedger = {
        id: "ledger-123",
        ...recordAdjustmentDto,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter: 3,
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce(mockEntitlements);
      mockDb.returning.mockResolvedValueOnce([mockLedger]);

      // Act
      const result = await service.recordAdjustment(recordAdjustmentDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.quantity).toBe(-2);
    });

    it("should throw exception when reason not provided", async () => {
      // Arrange
      const recordAdjustmentDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 3,
        reason: "", // Empty reason
        createdBy: "admin-123",
      };

      // Act & Assert
      await expect(
        service.recordAdjustment(recordAdjustmentDto),
      ).rejects.toThrow(ContractException);
    });

    it("should throw exception when entitlement not found", async () => {
      // Arrange
      const recordAdjustmentDto = {
        contractId: "contract-123",
        studentId: "student-123",
        serviceType: "resume_review",
        quantity: 3,
        reason: "Test reason",
        createdBy: "admin-123",
      };

      mockDb.where.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        service.recordAdjustment(recordAdjustmentDto),
      ).rejects.toThrow(ContractNotFoundException);
    });
  });

  describe("calculateAvailableBalance", () => {
    it("should calculate balance from multiple entitlements", async () => {
      // Arrange
      const mockEntitlements = [
        {
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 2,
          availableQuantity: 5,
        },
        {
          totalQuantity: 5,
          consumedQuantity: 1,
          heldQuantity: 1,
          availableQuantity: 3,
        },
      ];

      mockDb.where.mockResolvedValueOnce(mockEntitlements);

      // Act
      const result = await service.calculateAvailableBalance(
        "contract-123",
        "resume_review",
      );

      // Assert
      expect(result).toEqual({
        totalQuantity: 15,
        consumedQuantity: 4,
        heldQuantity: 3,
        availableQuantity: 8,
      });
    });

    it("should throw exception when entitlement not found", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        service.calculateAvailableBalance("contract-123", "resume_review"),
      ).rejects.toThrow(ContractNotFoundException);
    });
  });

  describe("queryLedgers", () => {
    it("should query ledgers from main table without archive", async () => {
      // Arrange
      const mockLedgers = [
        { id: "ledger-1", quantity: -1, createdAt: new Date() },
        { id: "ledger-2", quantity: -2, createdAt: new Date() },
      ];

      mockDb.offset.mockResolvedValueOnce(mockLedgers);

      // Act
      const result = await service.queryLedgers(
        { studentId: "student-123", serviceType: "resume_review" },
        { includeArchive: false, limit: 50, offset: 0 },
      );

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(mockDb.execute).not.toHaveBeenCalled(); // No UNION query
    });

    it("should query ledgers with archive using UNION ALL", async () => {
      // Arrange
      const mockLedgers = [
        { id: "ledger-1", quantity: -1 },
        { id: "ledger-archive-1", quantity: -2 },
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockLedgers });

      // Act - Archive queries now require date range (Decision I5)
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");
      const result = await service.queryLedgers(
        {
          studentId: "student-123",
          serviceType: "resume_review",
          startDate,
          endDate,
        },
        { includeArchive: true, limit: 50, offset: 0 },
      );

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it("should filter by date range", async () => {
      // Arrange
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");
      const mockLedgers = [
        { id: "ledger-1", createdAt: new Date("2025-01-15") },
      ];

      mockDb.offset.mockResolvedValueOnce(mockLedgers);

      // Act
      const result = await service.queryLedgers(
        {
          studentId: "student-123",
          serviceType: "resume_review",
          startDate,
          endDate,
        },
        { includeArchive: false },
      );

      // Assert
      expect(result).toEqual(mockLedgers);
    });
  });
});
