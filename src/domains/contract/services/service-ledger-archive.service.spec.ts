import { Test, TestingModule } from "@nestjs/testing";
import { ServiceLedgerArchiveService } from "./service-ledger-archive.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  ContractException,
  ContractNotFoundException,
  ContractConflictException,
} from "../common/exceptions/contract.exception";
import type { ServiceLedgerArchivePolicy, ServiceLedger } from "@infrastructure/database/schema";

describe("ServiceLedgerArchiveService", () => {
  let service: ServiceLedgerArchiveService;
  let mockDb: any;

  const createMockDb = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    transaction: jest.fn((callback) => callback(mockTx)),
  });

  const mockTx = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceLedgerArchiveService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ServiceLedgerArchiveService>(ServiceLedgerArchiveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("archiveOldLedgers", () => {
    it("should archive using global default when no policies exist", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([]); // No policies

      const mockLedgers = [
        { id: "ledger-1", contractId: "contract-123", createdAt: new Date("2024-01-01") },
        { id: "ledger-2", contractId: "contract-123", createdAt: new Date("2024-01-02") },
      ];

      mockDb.where.mockResolvedValueOnce(mockLedgers); // First archiveLedgers call
      mockDb.returning.mockResolvedValueOnce([]); // Insert result

      // Act
      const result = await service.archiveOldLedgers();

      // Assert
      expect(result).toBe(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should archive using multiple policies", async () => {
      // Arrange
      const mockPolicies: ServiceLedgerArchivePolicy[] = [
        {
          id: "policy-1",
          scope: "contract",
          contractId: "contract-123",
          serviceType: null,
          archiveAfterDays: 30,
          deleteAfterArchive: false,
          enabled: true,
          createdBy: "admin-001",
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: "Contract-level policy",
        },
        {
          id: "policy-2",
          scope: "service_type",
          contractId: null,
          serviceType: "resume_review",
          archiveAfterDays: 60,
          deleteAfterArchive: true,
          enabled: true,
          createdBy: "admin-001",
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: "Service type policy for resume_review",
        },
      ];

      mockDb.where.mockResolvedValueOnce(mockPolicies);

      // First policy archives 3 records
      const mockLedgers1 = [
        { id: "ledger-1", contractId: "contract-123", createdAt: new Date("2024-01-01") },
        { id: "ledger-2", contractId: "contract-123", createdAt: new Date("2024-01-02") },
        { id: "ledger-3", contractId: "contract-123", createdAt: new Date("2024-01-03") },
      ];
      mockDb.where.mockResolvedValueOnce(mockLedgers1);
      mockDb.returning.mockResolvedValueOnce([]);

      // Second policy archives 2 records
      const mockLedgers2 = [
        { id: "ledger-4", contractId: "contract-456", createdAt: new Date("2024-02-01") },
        { id: "ledger-5", contractId: "contract-456", createdAt: new Date("2024-02-02") },
      ];
      mockDb.where.mockResolvedValueOnce(mockLedgers2);
      mockDb.returning.mockResolvedValueOnce([]);

      // Act
      const result = await service.archiveOldLedgers();

      // Assert
      expect(result).toBe(5);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockDb.delete).toHaveBeenCalledTimes(1); // Only second policy has deleteAfterArchive=true
    });

    it("should return 0 when no ledgers to archive", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([]); // No policies
      mockDb.where.mockResolvedValueOnce([]); // No old ledgers

      // Act
      const result = await service.archiveOldLedgers();

      // Assert
      expect(result).toBe(0);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      mockDb.where.mockRejectedValueOnce(new Error("Database connection failed"));

      // Act & Assert
      await expect(service.archiveOldLedgers()).rejects.toThrow("Database connection failed");
    });
  });

  describe("getArchivePolicy", () => {
    it("should return contract-specific policy when it exists", async () => {
      // Arrange
      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-1",
        scope: "contract",
        contractId: "contract-123",
        serviceType: null,
        archiveAfterDays: 30,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: "Contract policy test",
      };

      mockDb.where.mockResolvedValueOnce([mockPolicy]);

      // Act
      const result = await service.getArchivePolicy("contract-123", "resume_review");

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result?.scope).toBe("contract");
    });

    it("should return service-type policy when no contract policy exists", async () => {
      // Arrange
      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-2",
        scope: "service_type",
        contractId: null,
        serviceType: "resume_review",
        archiveAfterDays: 60,
        deleteAfterArchive: true,
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: "Service type policy",
      };

      mockDb.where.mockResolvedValueOnce([]); // No contract policy
      mockDb.where.mockResolvedValueOnce([mockPolicy]); // Service type policy

      // Act
      const result = await service.getArchivePolicy("contract-456", "resume_review");

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result?.scope).toBe("service_type");
    });

    it("should return global policy when no specific policies exist", async () => {
      // Arrange
      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-3",
        scope: "global",
        contractId: null,
        serviceType: null,
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        updatedAt: new Date(),
        notes: "Global default policy",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([]); // No contract policy
      mockDb.where.mockResolvedValueOnce([]); // No service type policy
      mockDb.where.mockResolvedValueOnce([mockPolicy]); // Global policy

      // Act
      const result = await service.getArchivePolicy("contract-789", "mock_interview");

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result?.scope).toBe("global");
    });

    it("should return null when no policies exist", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([]); // No contract policy
      mockDb.where.mockResolvedValueOnce([]); // No service type policy
      mockDb.where.mockResolvedValueOnce([]); // No global policy

      // Act
      const result = await service.getArchivePolicy("contract-999", "other_service");

      // Assert
      expect(result).toBeNull();
    });

    it("should prioritize contract policy over service type and global", async () => {
      // Arrange
      const contractPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-1",
        scope: "contract",
        contractId: "contract-123",
        serviceType: null,
        archiveAfterDays: 30,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        updatedAt: new Date(),
        notes: "Contract-specific policy for testing",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([contractPolicy]); // Contract policy found

      // Act
      const result = await service.getArchivePolicy("contract-123", "resume_review");

      // Assert
      expect(result).toEqual(contractPolicy);
      // Should not query for service type or global policies
      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });
  });

  describe("createPolicy", () => {
    it("should create global policy successfully", async () => {
      // Arrange
      const dto = {
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        createdBy: "admin-001",
      };

      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-1",
        scope: "global",
        contractId: null,
        serviceType: null,
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        enabled: true,
        updatedAt: new Date(),
        notes: "Global policy for create test",
        createdBy: "admin-001",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([]); // No duplicate
      mockDb.returning.mockResolvedValueOnce([mockPolicy]);

      // Act
      const result = await service.createPolicy(dto);

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result.scope).toBe("global");
    });

    it("should create contract-specific policy", async () => {
      // Arrange
      const dto = {
        contractId: "contract-123",
        archiveAfterDays: 30,
        deleteAfterArchive: true,
        createdBy: "admin-001",
      };

      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-2",
        scope: "contract",
        contractId: "contract-123",
        serviceType: null,
        archiveAfterDays: 30,
        deleteAfterArchive: true,
        updatedAt: new Date(),
        notes: "Contract policy for create test",
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([]); // No duplicate
      mockDb.returning.mockResolvedValueOnce([mockPolicy]);

      // Act
      const result = await service.createPolicy(dto);

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result.scope).toBe("contract");
      expect(result.contractId).toBe("contract-123");
    });

    it("should create service-type policy", async () => {
      // Arrange
      const dto = {
        serviceType: "resume_review",
        archiveAfterDays: 60,
        deleteAfterArchive: false,
        createdBy: "admin-001",
      };

      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-3",
        scope: "service_type",
        contractId: null,
        serviceType: "resume_review",
        updatedAt: new Date(),
        notes: "Service-type policy for create test",
        archiveAfterDays: 60,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([]); // No duplicate
      mockDb.returning.mockResolvedValueOnce([mockPolicy]);

      // Act
      const result = await service.createPolicy(dto);

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result.scope).toBe("service_type");
      expect(result.serviceType).toBe("resume_review");
    });

    it("should throw error when archiveAfterDays is less than 1", async () => {
      // Arrange
      const dto = {
        archiveAfterDays: 0,
        deleteAfterArchive: false,
        createdBy: "admin-001",
      };

      // Act & Assert
      await expect(service.createPolicy(dto)).rejects.toThrow(ContractException);
      await expect(service.createPolicy(dto)).rejects.toThrow("ARCHIVE_AFTER_DAYS_TOO_SMALL");
    });

    it("should throw error when duplicate policy exists", async () => {
      // Arrange
      const dto = {
        contractId: "contract-123",
        archiveAfterDays: 30,
        deleteAfterArchive: false,
        createdBy: "admin-001",
      };

      const existingPolicy: ServiceLedgerArchivePolicy = {
        id: "existing-policy",
        scope: "contract",
        contractId: "contract-123",
        serviceType: null,
        archiveAfterDays: 45,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-002",
        updatedAt: new Date(),
        notes: "Existing policy for duplicate check",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([existingPolicy]); // Duplicate found

      // Act & Assert
      await expect(service.createPolicy(dto)).rejects.toThrow(ContractConflictException);
      await expect(service.createPolicy(dto)).rejects.toThrow("ARCHIVE_POLICY_ALREADY_EXISTS");
    });

    it("should work with transaction", async () => {
      // Arrange
      const dto = {
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        createdBy: "admin-001",
      };

      const mockPolicy: ServiceLedgerArchivePolicy = {
        id: "policy-1",
        updatedAt: new Date(),
        notes: "Global policy for transaction test",
        scope: "global",
        contractId: null,
        serviceType: null,
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
      };

      mockTx.where.mockResolvedValueOnce([]); // No duplicate
      mockTx.returning.mockResolvedValueOnce([mockPolicy]);

      // Act
      const result = await service.createPolicy(dto, mockTx as any);

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("updatePolicy", () => {
    it("should update policy successfully", async () => {
      // Arrange
      const policyId = "policy-1";
      const updates = {
        archiveAfterDays: 120,
        deleteAfterArchive: true,
      };

      const existingPolicy: ServiceLedgerArchivePolicy = {
        id: policyId,
        scope: "global",
        contractId: null,
        serviceType: null,
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: "Policy for update validation test",
      };

      const updatedPolicy: ServiceLedgerArchivePolicy = {
        ...existingPolicy,
        archiveAfterDays: 120,
        deleteAfterArchive: true,
      };

      mockDb.where.mockResolvedValueOnce([existingPolicy]);
      mockDb.returning.mockResolvedValueOnce([updatedPolicy]);

      // Act
      const result = await service.updatePolicy(policyId, updates);

      // Assert
      expect(result).toEqual(updatedPolicy);
      expect(result.archiveAfterDays).toBe(120);
      expect(result.deleteAfterArchive).toBe(true);
    });

    it("should throw error when policy not found", async () => {
      // Arrange
      const policyId = "non-existent";
      const updates = {
        archiveAfterDays: 120,
      };

      mockDb.where.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        ContractNotFoundException,
      );
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        "ARCHIVE_POLICY_NOT_FOUND",
      );
    });

    it("should throw error when archiveAfterDays is too small", async () => {
      // Arrange
      const policyId = "policy-1";
      const updates = {
        archiveAfterDays: 0,
      };

      const existingPolicy: ServiceLedgerArchivePolicy = {
        id: policyId,
        scope: "global",
        contractId: null,
        serviceType: null,
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        updatedAt: new Date(),
        notes: "Policy for validation error test",
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([existingPolicy]);

      // Act & Assert
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        ContractException,
      );
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        "ARCHIVE_AFTER_DAYS_TOO_SMALL",
      );
    });

    it("should work with transaction", async () => {
      // Arrange
      const policyId = "policy-1";
      const updates = {
        isActive: false,
      };

      const existingPolicy: ServiceLedgerArchivePolicy = {
        id: policyId,
        scope: "global",
        contractId: null,
        serviceType: null,
        archiveAfterDays: 90,
        deleteAfterArchive: false,
        enabled: true,
        createdBy: "admin-001",
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: "Policy for transaction test",
      };

      const updatedPolicy: ServiceLedgerArchivePolicy = {
        ...existingPolicy,
        enabled: false,
      };

      mockTx.where.mockResolvedValueOnce([existingPolicy]);
      mockTx.returning.mockResolvedValueOnce([updatedPolicy]);

      // Act
      const result = await service.updatePolicy(policyId, updates, mockTx as any);

      // Assert
      expect(result).toEqual(updatedPolicy);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("queryWithArchive", () => {
    it("should query both main and archive tables", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const filter = {
        contractId: "contract-123",
        startDate,
        endDate,
        limit: 50,
      };

      const mockLedgers: ServiceLedger[] = [
        {
          id: "ledger-1",
          contractId: "contract-123",
          studentId: "student-456",
          serviceType: "resume_review",
          quantity: -1,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: 9,
          relatedBookingId: "session-1",
          reason: null,
          createdAt: new Date("2024-01-15"),
          createdBy: "user-001",
          metadata: null,
          relatedHoldId: null,
        },
        {
          id: "ledger-archive-1",
          contractId: "contract-123",
          studentId: "student-456",
          serviceType: "resume_review",
          quantity: -1,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: 10,
          relatedBookingId: "session-2",
          reason: null,
          createdAt: new Date("2024-01-10"),
          createdBy: "user-001",
          metadata: null,
          relatedHoldId: null,
        },
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockLedgers });

      // Act
      const result = await service.queryWithArchive(filter);

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(result).toHaveLength(2);
      expect(result[0].createdAt.getTime()).toBeGreaterThan(result[1].createdAt.getTime()); // Ordered by createdAt DESC
    });

    it("should throw error when date range exceeds 1 year", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2025-02-01"); // More than 1 year
      const filter = {
        contractId: "contract-123",
        startDate,
        endDate,
      };

      // Act & Assert
      await expect(service.queryWithArchive(filter)).rejects.toThrow(ContractException);
      await expect(service.queryWithArchive(filter)).rejects.toThrow("ARCHIVE_DATE_RANGE_TOO_LARGE");
    });

    it("should filter by studentId", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const filter = {
        studentId: "student-456",
        startDate,
        endDate,
      };

      const mockLedgers: ServiceLedger[] = [
        {
          id: "ledger-1",
          contractId: "contract-123",
          studentId: "student-456",
          serviceType: "resume_review",
          quantity: -1,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: 9,
          relatedBookingId: "session-1",
          reason: null,
          createdAt: new Date("2024-01-15"),
          createdBy: "user-001",
          metadata: null,
          relatedHoldId: null,
        },
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockLedgers });

      // Act
      const result = await service.queryWithArchive(filter);

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(result[0].studentId).toBe("student-456");
    });

    it("should filter by serviceType", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const filter = {
        serviceType: "mock_interview",
        startDate,
        endDate,
      };

      const mockLedgers: ServiceLedger[] = [
        {
          id: "ledger-1",
          contractId: "contract-123",
          studentId: "student-456",
          serviceType: "mock_interview",
          quantity: -1,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: 9,
          relatedBookingId: "session-1",
          reason: null,
          createdAt: new Date("2024-01-15"),
          createdBy: "user-001",
          metadata: null,
          relatedHoldId: null,
        },
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockLedgers });

      // Act
      const result = await service.queryWithArchive(filter);

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(result[0].serviceType).toBe("mock_interview");
    });

    it("should apply limit correctly", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const filter = {
        contractId: "contract-123",
        startDate,
        endDate,
        limit: 10,
      };

      const mockLedgers: ServiceLedger[] = Array.from({ length: 10 }, (_, i) => ({
        id: `ledger-${i}`,
        contractId: "contract-123",
        studentId: "student-456",
        serviceType: "resume_review",
        quantity: -1,
        type: "consumption",
        source: "booking_completed",
        balanceAfter: 10 - i,
        relatedBookingId: `session-${i}`,
        reason: null,
        createdAt: new Date(`2024-01-${i + 1}`),
        createdBy: "user-001",
        metadata: null,
        relatedHoldId: null,
      }));

      mockDb.execute.mockResolvedValueOnce({ rows: mockLedgers });

      // Act
      const result = await service.queryWithArchive(filter);

      // Assert
      expect(result).toHaveLength(10);
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });
});
