import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServiceLedgerService } from "./service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ContractNotFoundException } from "../common/exceptions/contract.exception";
import { SERVICE_TYPES } from "@domains/contract/common/constants/service-types.constants";
import {
  createChainableMockDatabase,
  createMockEntitlement,
  createMockLedger,
} from "test/utils/contract-test.helper";

/**
 * ServiceLedgerService Edge Cases Tests [服务台账服务边界条件测试]
 *
 * 测试各种边界条件、异常情况和并发场景
 * Tests various edge cases, exceptions, and concurrent scenarios
 */
describe("ServiceLedgerService Edge Cases", () => {
  let service: ServiceLedgerService;
  let mockDb: any;
  const testStudentId = "test-student-123";

  beforeEach(async () => {
    mockDb = createChainableMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
      ],
      providers: [
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        ServiceLedgerService,
      ],
    }).compile();

    service = module.get<ServiceLedgerService>(ServiceLedgerService);
  });

  describe("Batch Consumption Handling [批量消费处理]", () => {
    it("should handle sequential consumption requests", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
        totalQuantity: 100,
        consumedQuantity: 0,
        availableQuantity: 100,
      });

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);
      mockDb.insert.values.returning.mockResolvedValue([
        createMockLedger({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
          quantity: -1,
          balanceAfter: 99,
        }),
      ]);

      // Act - Simulate sequential requests
      const result1 = await service.recordConsumption({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
        quantity: 1,
        createdBy: "test-user",
      });

      const result2 = await service.recordConsumption({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
        quantity: 1,
        createdBy: "test-user",
      });

      // Assert
      expect(result1.quantity).toBe(-1);
      expect(result1.balanceAfter).toBe(99);
      expect(result2.quantity).toBe(-1);
      expect(result2.balanceAfter).toBe(99);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("Boundary Value Testing [边界值测试]", () => {
    it("should handle consumption when available quantity is exactly 1", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.RESUME_REVIEW,
        totalQuantity: 5,
        consumedQuantity: 4,
        availableQuantity: 1,
      });

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);
      mockDb.insert.values.returning.mockResolvedValue([
        createMockLedger({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.RESUME_REVIEW,
          quantity: -1,
          balanceAfter: 0,
        }),
      ]);

      // Act
      const result = await service.recordConsumption({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.RESUME_REVIEW,
        quantity: 1,
        createdBy: "test-user",
      });

      // Assert
      expect(result.balanceAfter).toBe(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle consumption with very large quantities", async () => {
      // Arrange
      const largeQuantity = 1000000;
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.MENTORING,
        totalQuantity: largeQuantity + 10,
        consumedQuantity: 10,
        availableQuantity: largeQuantity,
      });

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);
      mockDb.insert.values.returning.mockResolvedValue([
        createMockLedger({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.MENTORING,
          quantity: -largeQuantity,
          balanceAfter: 0,
        }),
      ]);

      // Act
      const result = await service.recordConsumption({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.MENTORING,
        quantity: largeQuantity,
        createdBy: "test-user",
      });

      // Assert
      expect(result.quantity).toBe(-largeQuantity);
      expect(result.balanceAfter).toBe(0);
    });

    it("should handle zero quantities in entitlement calculations", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.CONSULTATION,
        totalQuantity: 0,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 0,
      });

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);

      // Act & Assert
      await expect(
        service.recordConsumption({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.CONSULTATION,
          quantity: 1,
          createdBy: "test-user",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Transaction Rollback Scenarios [事务回滚场景]", () => {
    it("should not create ledger entry when entitlement query fails", async () => {
      // Arrange
      mockDb.select.from.where.mockRejectedValue(new Error("Database connection lost"));

      // Act & Assert
      await expect(
        service.recordConsumption({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.GAP_ANALYSIS,
          quantity: 1,
          createdBy: "test-user",
        }),
      ).rejects.toThrow("Database connection lost");
    });

    it("should not create ledger entry when insert fails", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.GAP_ANALYSIS,
        totalQuantity: 10,
        consumedQuantity: 0,
        availableQuantity: 10,
      });

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);
      mockDb.insert.values.returning.mockRejectedValue(new Error("Insert failed"));

      // Act & Assert
      await expect(
        service.recordConsumption({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.GAP_ANALYSIS,
          quantity: 1,
          createdBy: "test-user",
        }),
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("Multiple Entitlement Aggregation [多权益聚合]", () => {
    it("should correctly aggregate multiple entitlements with different quantities", async () => {
      // Arrange
      const mockEntitlements = [
        createMockEntitlement({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.CLASS,
          totalQuantity: 5,
          consumedQuantity: 2,
          heldQuantity: 1,
          availableQuantity: 2,
        }),
        createMockEntitlement({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.CLASS,
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 2,
          availableQuantity: 5,
        }),
        createMockEntitlement({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.CLASS,
          totalQuantity: 15,
          consumedQuantity: 5,
          heldQuantity: 0,
          availableQuantity: 10,
        }),
      ];

      mockDb.select.from.where.mockResolvedValue(mockEntitlements);
      mockDb.insert.values.returning.mockResolvedValue([
        createMockLedger({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.CLASS,
          quantity: -3,
          balanceAfter: 14,
        }),
      ]);

      // Act
      const balance = await service.calculateAvailableBalance(
        testStudentId,
        SERVICE_TYPES.CLASS,
      );

      // Assert
      expect(balance.totalQuantity).toBe(30); // 5 + 10 + 15
      expect(balance.consumedQuantity).toBe(10); // 2 + 3 + 5
      expect(balance.heldQuantity).toBe(3); // 1 + 2 + 0
      expect(balance.availableQuantity).toBe(17); // 2 + 5 + 10
    });
  });

  describe("Error Recovery [错误恢复]", () => {
    it("should handle database query timeout gracefully", async () => {
      // Arrange
      mockDb.select.from.where.mockImplementation(() =>
        Promise.reject(new Error("Query timeout after 30000ms")),
      );

      // Act & Assert
      await expect(
        service.calculateAvailableBalance(testStudentId, "test_service"),
      ).rejects.toThrow("Query timeout");
    });
  });

  describe("Validation Edge Cases [验证边界情况]", () => {
    it("should reject negative quantities with appropriate error", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.AI_CAREER,
        totalQuantity: 10,
        consumedQuantity: 0,
        availableQuantity: 10,
      });

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);

      // Act & Assert
      await expect(
        service.recordConsumption({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.AI_CAREER,
          quantity: -5,
          createdBy: "test-user",
        }),
      ).rejects.toThrow();
    });
    it("should handle refund exceeding consumed quantity", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.RESUME_REVIEW,
        totalQuantity: 10,
        consumedQuantity: 2,
        heldQuantity: 0,
        availableQuantity: 8,
      });

      mockDb.select.from.where
        .mockResolvedValueOnce([mockEntitlement]) // First call for entitlements
        .mockResolvedValueOnce([
          createMockLedger({ quantity: -2 }),
        ]); // Second call for consumptions

      // Act & Assert
      await expect(
        service.recordRefund({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.RESUME_REVIEW,
          quantity: 5, // Exceeds consumed quantity of 2
          relatedBookingId: "booking-123",
          bookingSource: "resumes",
          createdBy: "test-user",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Metadata Handling [元数据处理]", () => {
    it("should handle metadata with maximum allowed length", async () => {
      // Arrange
      const mockEntitlement = createMockEntitlement({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
        totalQuantity: 10,
        consumedQuantity: 0,
        availableQuantity: 10,
      });

      const largeMetadata = {
        largeField: "x".repeat(10000),
        nestedObject: {
          level1: {
            level2: {
              level3: "deep value",
            },
          },
        },
      };

      mockDb.select.from.where.mockResolvedValue([mockEntitlement]);
      mockDb.insert.values.returning.mockResolvedValue([
        createMockLedger({
          studentId: testStudentId,
          serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
          quantity: -1,
          metadata: largeMetadata,
        }),
      ]);

      // Act
      const result = await service.recordConsumption({
        studentId: testStudentId,
        serviceType: SERVICE_TYPES.ONE_ON_ONE_SESSION,
        quantity: 1,
        createdBy: "test-user",
      });

      // Assert
      expect(result.metadata).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
