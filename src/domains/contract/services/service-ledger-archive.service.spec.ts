import { Test, TestingModule } from "@nestjs/testing";
import { ServiceLedgerArchiveService } from "./service-ledger-archive.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  ContractException,
  ContractNotFoundException,
  ContractConflictException,
  CONTRACT_ERROR_MESSAGES,
} from "../common/exceptions/contract.exception";
import type {
  ServiceLedgerArchivePolicy,
  ServiceLedger,
} from "@infrastructure/database/schema";

describe("ServiceLedgerArchiveService", () => {
  let service: ServiceLedgerArchiveService;
  let mockDb: any;

  const createMockDb = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
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
    limit: jest.fn().mockReturnThis(),
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

    service = module.get<ServiceLedgerArchiveService>(
      ServiceLedgerArchiveService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("archiveOldLedgers", () => {
    it("should archive using global default when no policies exist", async () => {
      // Arrange
      mockDb.where.mockResolvedValueOnce([]); // No policies

      const mockLedgers = [
        {
          id: "ledger-1",
          studentId: "student-1",
          serviceType: "resume_review",
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "ledger-2",
          studentId: "student-2",
          serviceType: "resume_review",
          createdAt: new Date("2024-01-02"),
        },
      ];

      // Mock contract amendment ledgers to provide contract IDs
      const mockContractAmendments = [
        {
          studentId: "student-1",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-123" },
        },
        {
          studentId: "student-2",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-123" },
        },
      ];

      mockDb.where.mockResolvedValueOnce(mockLedgers); // First archiveLedgers call
      mockDb.where.mockResolvedValueOnce(mockContractAmendments); // Contract amendment data
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
        {
          id: "ledger-1",
          studentId: "student-1",
          serviceType: "resume_review",
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "ledger-2",
          studentId: "student-2",
          serviceType: "resume_review",
          createdAt: new Date("2024-01-02"),
        },
        {
          id: "ledger-3",
          studentId: "student-3",
          serviceType: "resume_review",
          createdAt: new Date("2024-01-03"),
        },
      ];

      // Mock contract amendment ledgers for first policy
      const mockContractAmendments1 = [
        {
          studentId: "student-1",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-123" },
        },
        {
          studentId: "student-2",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-123" },
        },
        {
          studentId: "student-3",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-123" },
        },
      ];

      mockDb.where.mockResolvedValueOnce(mockLedgers1);
      mockDb.where.mockResolvedValueOnce(mockContractAmendments1);
      mockDb.returning.mockResolvedValueOnce([]);

      // Second policy archives 2 records
      const mockLedgers2 = [
        {
          id: "ledger-4",
          studentId: "student-4",
          serviceType: "resume_review",
          createdAt: new Date("2024-02-01"),
        },
        {
          id: "ledger-5",
          studentId: "student-5",
          serviceType: "resume_review",
          createdAt: new Date("2024-02-02"),
        },
      ];

      // Mock contract amendment ledgers for second policy
      const mockContractAmendments2 = [
        {
          studentId: "student-4",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-456" },
        },
        {
          studentId: "student-5",
          serviceType: "resume_review",
          snapshot: { contractId: "contract-456" },
        },
      ];

      mockDb.where.mockResolvedValueOnce(mockLedgers2);
      mockDb.where.mockResolvedValueOnce(mockContractAmendments2);
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
      // Simulate database connection failure - this is an expected error scenario in unit tests
      // 模拟数据库连接失败 - 这是单元测试中的预期错误场景
      mockDb.where.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      // Act & Assert
      // Verify that the service properly propagates the database error
      // 验证服务是否正确传播数据库错误
      await expect(service.archiveOldLedgers()).rejects.toThrow(
        "Database connection failed",
      );
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockPolicy]),
      };
      
      mockDb.select.mockReturnValueOnce(mockSelectChain);

      // Act
      const result = await service.getArchivePolicy(
        "contract-123",
        "resume_review",
      );

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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockPolicy]),
      };
      
      mockDb.select
        .mockReturnValueOnce(mockSelectChain)
        .mockReturnValueOnce(mockSelectChain2);

      // Act
      const result = await service.getArchivePolicy(
        "contract-456",
        "resume_review",
      );

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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);
      
      // Set up second call for service type policy
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      // Set up third call for global policy
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockPolicy]),
      };
      
      mockDb.select
        .mockReturnValueOnce(mockSelectChain)
        .mockReturnValueOnce(mockSelectChain2)
        .mockReturnValueOnce(mockSelectChain3);

      // Act
      const result = await service.getArchivePolicy(
        "contract-789",
        "mock_interview",
      );

      // Assert
      expect(result).toEqual(mockPolicy);
      expect(result?.scope).toBe("global");
    });

    it("should return null when no policies exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      mockDb.select
        .mockReturnValueOnce(mockSelectChain)
        .mockReturnValueOnce(mockSelectChain2)
        .mockReturnValueOnce(mockSelectChain3);

      // Act
      const result = await service.getArchivePolicy(
        "contract-999",
        "other_service",
      );

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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([contractPolicy]),
      };
      
      mockDb.select.mockReturnValueOnce(mockSelectChain);

      // Act
      const result = await service.getArchivePolicy(
        "contract-123",
        "resume_review",
      );

      // Assert
      expect(result).toEqual(contractPolicy);
      // Should not query for service type or global policies
      expect(mockDb.select).toHaveBeenCalledTimes(1);
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]), // No duplicate
        limit: jest.fn().mockReturnThis(),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]), // No duplicate
        limit: jest.fn().mockReturnThis(),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]), // No duplicate
        limit: jest.fn().mockReturnThis(),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);
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
      await expect(service.createPolicy(dto)).rejects.toThrow(
        ContractException,
      );
      await expect(service.createPolicy(dto)).rejects.toThrow(
        CONTRACT_ERROR_MESSAGES.ARCHIVE_AFTER_DAYS_TOO_SMALL,
      );
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([existingPolicy]), // Duplicate found
        limit: jest.fn().mockReturnThis(),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);

      // Act & Assert
      await expect(service.createPolicy(dto)).rejects.toThrow(
        ContractConflictException,
      );
      await expect(service.createPolicy(dto)).rejects.toThrow(
        CONTRACT_ERROR_MESSAGES.ARCHIVE_POLICY_ALREADY_EXISTS,
      );
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]), // No duplicate
        limit: jest.fn().mockReturnThis(),
      };
      
      mockTx.select.mockReturnValue(mockSelectChain);
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingPolicy]),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);

      // Act & Assert
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        ContractNotFoundException,
      );
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        CONTRACT_ERROR_MESSAGES.ARCHIVE_POLICY_NOT_FOUND
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

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingPolicy]),
      };
      
      mockDb.select.mockReturnValue(mockSelectChain);

      // Act & Assert
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        ContractException,
      );
      await expect(service.updatePolicy(policyId, updates)).rejects.toThrow(
        CONTRACT_ERROR_MESSAGES.ARCHIVE_AFTER_DAYS_TOO_SMALL,
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

      // Set up the mock chain for transaction
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingPolicy]),
      };
      
      mockTx.select.mockReturnValue(mockSelectChain);
      mockTx.returning.mockResolvedValueOnce([updatedPolicy]);

      // Act
      const result = await service.updatePolicy(
        policyId,
        updates,
        mockTx as any,
      );

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
      expect(result[0].createdAt.getTime()).toBeGreaterThan(
        result[1].createdAt.getTime(),
      ); // Ordered by createdAt DESC
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
      await expect(service.queryWithArchive(filter)).rejects.toThrow(
        ContractException,
      );
      await expect(service.queryWithArchive(filter)).rejects.toThrow(
        CONTRACT_ERROR_MESSAGES.ARCHIVE_DATE_RANGE_TOO_LARGE,
      );
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

      const mockLedgers: ServiceLedger[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `ledger-${i}`,
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
        }),
      );

      mockDb.execute.mockResolvedValueOnce({ rows: mockLedgers });

      // Act
      const result = await service.queryWithArchive(filter);

      // Assert
      expect(result).toHaveLength(10);
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });
});
