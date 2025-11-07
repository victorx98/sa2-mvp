import { Test, TestingModule } from "@nestjs/testing";
import { ContractService } from "./contract.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";

describe("ContractService", () => {
  let service: ContractService;
  let mockDb: any;

  // Mock database connection
  const createMockDb = () => ({
    execute: jest.fn(),
    transaction: jest.fn((callback) => callback(mockTx)),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    for: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  });

  // Mock transaction
  const mockTx = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    for: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a contract successfully", async () => {
      // Arrange
      const createContractDto = {
        studentId: "student-123",
        productId: "product-456",
        productSnapshot: {
          productId: "product-456",
          productName: "Test Product",
          productCode: "TEST-PROD",
          price: "1000.00",
          currency: "USD",
          validityDays: 365,
          items: [],
          snapshotAt: new Date(),
        },
        createdBy: "admin-123",
      };

      const mockContractNumber = "CONTRACT-2025-01-00001";
      const mockContract = {
        id: "contract-123",
        contractNumber: mockContractNumber,
        ...createContractDto,
        status: "signed",
        totalAmount: "1000.00",
        currency: "USD",
        signedAt: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database function response
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ contract_number: mockContractNumber }],
      });

      // Mock insert returning
      mockTx.returning.mockResolvedValueOnce([mockContract]);

      // Act
      const result = await service.create(createContractDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.contractNumber).toBe(mockContractNumber);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("should throw exception for invalid price", async () => {
      // Arrange
      const createContractDto = {
        studentId: "student-123",
        productId: "product-456",
        productSnapshot: {
          productId: "product-456",
          productName: "Test Product",
          productCode: "TEST-PROD",
          price: "0", // Invalid price
          currency: "USD",
          items: [],
          snapshotAt: new Date(),
        },
        createdBy: "admin-123",
      };

      // Act & Assert
      await expect(service.create(createContractDto)).rejects.toThrow(Error);
    });
  });

  describe("findOne", () => {
    it("should find contract by contractId", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        contractNumber: "CONTRACT-2025-01-00001",
        studentId: "student-123",
        status: "active",
      };

      mockDb.limit.mockResolvedValueOnce([mockContract]);

      // Act
      const result = await service.findOne({ contractId: "contract-123" });

      // Assert
      expect(result).toBeDefined();
      expect(result).toEqual(mockContract);
    });

    it("should return null when contract not found", async () => {
      // Arrange
      mockDb.limit.mockResolvedValueOnce([]);

      // Act
      const result = await service.findOne({ contractId: "non-existent" });

      // Assert
      expect(result).toBeNull();
    });

    it("should throw exception when multiple contracts found", async () => {
      // Arrange
      const mockContracts = [{ id: "contract-1" }, { id: "contract-2" }];

      mockDb.limit.mockResolvedValueOnce(mockContracts);

      // Act & Assert
      await expect(
        service.findOne({ studentId: "student-123", status: "active" }),
      ).rejects.toThrow(ContractException);
    });

    it("should throw exception when no query condition provided", async () => {
      // Act & Assert
      await expect(service.findOne({})).rejects.toThrow(ContractException);
    });
  });

  describe("activate", () => {
    it("should activate contract successfully", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        contractNumber: "CONTRACT-2025-01-00001",
        status: "signed",
        productSnapshot: {
          items: [
            {
              productItemType: "service",
              productItemId: "item-1",
              quantity: 5,
              service: {
                serviceId: "service-1",
                serviceName: "Resume Review",
                serviceCode: "resume_review",
                serviceType: "resume_review",
                billingMode: "times",
                requiresEvaluation: false,
                requiresMentorAssignment: true,
                snapshotAt: new Date(),
              },
            },
          ],
        },
        expiresAt: new Date(),
      };

      const mockUpdatedContract = {
        ...mockContract,
        status: "active",
        activatedAt: new Date(),
      };

      // Mock findOne
      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);

      // Mock transaction
      mockTx.returning.mockResolvedValueOnce([mockUpdatedContract]);

      // Act
      const result = await service.activate("contract-123");

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("active");
    });

    it("should throw exception when contract not found", async () => {
      // Arrange
      jest.spyOn(service, "findOne").mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.activate("non-existent")).rejects.toThrow(
        ContractNotFoundException,
      );
    });

    it("should throw exception when contract not in signed status", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "active", // Already active
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);

      // Act & Assert
      await expect(service.activate("contract-123")).rejects.toThrow(
        ContractException,
      );
    });
  });

  describe("terminate", () => {
    it("should terminate contract successfully", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "active",
      };

      const mockTerminatedContract = {
        ...mockContract,
        status: "terminated",
        terminatedAt: new Date(),
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);
      mockTx.returning.mockResolvedValueOnce([mockTerminatedContract]);

      // Act
      const result = await service.terminate(
        "contract-123",
        "Customer request",
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("terminated");
    });

    it("should throw exception when reason not provided", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "active",
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);

      // Act & Assert
      await expect(
        service.terminate("contract-123", "", "admin-123"),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("suspend", () => {
    it("should suspend contract successfully", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "active",
      };

      const mockSuspendedContract = {
        ...mockContract,
        status: "suspended",
        suspendedAt: new Date(),
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);
      mockTx.returning.mockResolvedValueOnce([mockSuspendedContract]);

      // Act
      const result = await service.suspend(
        "contract-123",
        "Payment issue",
        "admin-123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("suspended");
    });

    it("should throw exception when contract not active", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "terminated",
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);

      // Act & Assert
      await expect(
        service.suspend("contract-123", "Test reason", "admin-123"),
      ).rejects.toThrow(ContractException);
    });
  });

  describe("resume", () => {
    it("should resume contract successfully", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "suspended",
      };

      const mockResumedContract = {
        ...mockContract,
        status: "active",
        suspendedAt: null,
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);
      mockTx.returning.mockResolvedValueOnce([mockResumedContract]);

      // Act
      const result = await service.resume("contract-123", "admin-123");

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("active");
      expect(result.suspendedAt).toBeNull();
    });

    it("should throw exception when contract not suspended", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "active",
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);

      // Act & Assert
      await expect(service.resume("contract-123", "admin-123")).rejects.toThrow(
        ContractException,
      );
    });
  });

  describe("complete", () => {
    it("should complete contract successfully", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "active",
      };

      const mockCompletedContract = {
        ...mockContract,
        status: "completed",
        completedAt: new Date(),
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);
      mockTx.returning.mockResolvedValueOnce([mockCompletedContract]);

      // Act
      const result = await service.complete("contract-123", "admin-123");

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("completed");
    });

    it("should throw exception when contract not active", async () => {
      // Arrange
      const mockContract = {
        id: "contract-123",
        status: "terminated",
      };

      jest.spyOn(service, "findOne").mockResolvedValueOnce(mockContract as any);

      // Act & Assert
      await expect(service.complete("contract-123")).rejects.toThrow(
        ContractException,
      );
    });
  });
});
