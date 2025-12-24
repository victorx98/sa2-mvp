import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ServiceLedgerService } from "./service-ledger.service";
import {
  ContractException,
  ContractNotFoundException,
} from "../common/exceptions/contract.exception";
import {
  IRecordConsumptionDto,
  IRecordAdjustmentDto,
} from "../interfaces/service-ledger.interface";
import { randomUUID } from "crypto";

/**
 * Unit Tests for ServiceLedgerService - CORRECTED VERSION
 * All mocks properly configured without .for() method (not used in service-ledger)
 */
describe("ServiceLedgerService Unit Tests [服务台账服务单元测试]", () => {
  let moduleRef: TestingModule;
  let serviceLedgerService: ServiceLedgerService;
  let mockDb: any;
  const testStudentId = randomUUID();
  const testServiceType = "CONSULTATION";
  const testCreatedBy = randomUUID();
  const testRelatedBookingId = randomUUID();

  beforeEach(async () => {
    // Create mock database with properly configured chains
    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
      transaction: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
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

    serviceLedgerService =
      moduleRef.get<ServiceLedgerService>(ServiceLedgerService);
  });

  afterEach(() => {
    // Clear all mocks but preserve implementations
    jest.clearAllMocks();
  });

  describe("recordConsumption() [记录消费]", () => {
    it("should record consumption successfully [应该成功记录消费]", async () => {
      // Arrange
      const dto: IRecordConsumptionDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1, // Requesting to consume 1 (positive, will be negated in ledger)
        relatedBookingId: testRelatedBookingId,
        bookingSource: "regular_mentoring_sessions", // Required when relatedBookingId is provided [当relatedBookingId存在时必填]
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
          consumedQuantity: 0,
          totalQuantity: 10,
          heldQuantity: 0,
        },
      ];

      const mockLedger = {
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -1, // Ledger stores negative
        type: "consumption",
        balanceAfter: 4,
        source: "booking_completed",
        metadata: { bookingSource: "regular_mentoring_sessions" },
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordConsumption(dto);

      // Assert
      expect(result).toEqual(mockLedger);
      expect(result.quantity).toBe(-1);
      expect(result.type).toBe("consumption");
      // Verify metadata.bookingSource is stored [验证metadata.bookingSource已存储]
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = (mockDb.insert as jest.Mock).mock.results[0].value;
      const valuesCall = insertCall.values as jest.Mock;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { bookingSource: "regular_mentoring_sessions" },
        }),
      );
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should reject negative quantity in DTO [应该拒绝DTO中的负数量]", async () => {
      // Arrange - Passing negative quantity in DTO is invalid
      // (DTO.quantity represents "units to consume", must be positive)
      const dto: IRecordConsumptionDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -5, // Invalid: cannot consume negative units
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
          consumedQuantity: 0,
          totalQuantity: 10,
          heldQuantity: 0,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act & Assert - Should throw because -(-5) = 5 is not negative
      await expect(serviceLedgerService.recordConsumption(dto)).rejects.toThrow(
        "Consumption quantity must be negative",
      );
    });

    it("should reject zero quantity [应该拒绝零数量]", async () => {
      // Arrange
      const dto: IRecordConsumptionDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 0,
        createdBy: testCreatedBy,
      };

      // Act & Assert
      await expect(serviceLedgerService.recordConsumption(dto)).rejects.toThrow(
        "Quantity change cannot be zero",
      );
    });

    it("should throw error if no entitlements found [如果未找到权益应该抛出错误]", async () => {
      // Arrange
      const dto: IRecordConsumptionDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1, // Positive quantity to consume 1
        createdBy: testCreatedBy,
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act & Assert
      await expect(serviceLedgerService.recordConsumption(dto)).rejects.toThrow(
        ContractNotFoundException,
      );
    });

    it("should throw error when relatedBookingId exists but bookingSource is missing [当relatedBookingId存在但bookingSource缺失时应该抛出错误]", async () => {
      // Arrange
      const dto: IRecordConsumptionDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        relatedBookingId: testRelatedBookingId, // relatedBookingId exists [relatedBookingId存在]
        // bookingSource is missing [bookingSource缺失]
        createdBy: testCreatedBy,
      };

      // Act & Assert
      await expect(serviceLedgerService.recordConsumption(dto)).rejects.toThrow(
        ContractException,
      );
      try {
        await serviceLedgerService.recordConsumption(dto);
        fail("Expected ContractException to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ContractException);
        expect((error as ContractException).code).toBe(
          "BOOKING_SOURCE_REQUIRED",
        );
      }
    });

    it("should store metadata.bookingSource when relatedBookingId is provided [当提供relatedBookingId时应该存储metadata.bookingSource]", async () => {
      // Arrange
      const dto: IRecordConsumptionDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        relatedBookingId: testRelatedBookingId,
        bookingSource: "job_applications",
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
          consumedQuantity: 0,
          totalQuantity: 10,
          heldQuantity: 0,
        },
      ];

      const mockLedger = {
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -1,
        type: "consumption",
        balanceAfter: 4,
        source: "booking_completed",
        metadata: { bookingSource: "job_applications" },
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordConsumption(dto);

      // Assert
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.bookingSource).toBe("job_applications");
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = (mockDb.insert as jest.Mock).mock.results[0].value;
      const valuesCall = insertCall.values as jest.Mock;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { bookingSource: "job_applications" },
        }),
      );
    });
  });

  describe("calculateAvailableBalance() [计算可用余额]", () => {
    it("should calculate balance correctly [应该正确计算余额]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 2,
          availableQuantity: 5,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act
      const result = await serviceLedgerService.calculateAvailableBalance(
        testStudentId,
        testServiceType,
      );

      // Assert
      expect(result).toEqual({
        totalQuantity: 10,
        consumedQuantity: 3,
        heldQuantity: 2,
        availableQuantity: 5,
      });
    });

    it("should aggregate multiple entitlements [应该聚合多个权益]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 10,
          consumedQuantity: 3,
          heldQuantity: 2,
          availableQuantity: 5,
        },
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 20,
          consumedQuantity: 5,
          heldQuantity: 3,
          availableQuantity: 12,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act
      const result = await serviceLedgerService.calculateAvailableBalance(
        testStudentId,
        testServiceType,
      );

      // Assert
      expect(result).toEqual({
        totalQuantity: 30,
        consumedQuantity: 8,
        heldQuantity: 5,
        availableQuantity: 17,
      });
    });

    it("should throw error if no entitlements found [如果未找到权益应该抛出错误]", async () => {
      // Arrange
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act & Assert
      await expect(
        serviceLedgerService.calculateAvailableBalance(
          testStudentId,
          testServiceType,
        ),
      ).rejects.toThrow(ContractNotFoundException);
    });

    it("should handle zero quantities correctly [应该正确处理零数量]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 0,
          consumedQuantity: 0,
          heldQuantity: 0,
          availableQuantity: 0,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act
      const result = await serviceLedgerService.calculateAvailableBalance(
        testStudentId,
        testServiceType,
      );

      // Assert
      expect(result).toEqual({
        totalQuantity: 0,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 0,
      });
    });
  });

  describe("recordAdjustment() [记录手动调整]", () => {
    it("should successfully record positive adjustment [应该成功记录正向调整]", async () => {
      // Arrange
      const dto: IRecordAdjustmentDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 5,
        reason: "Special bonus",
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 10,
          consumedQuantity: 2,
          heldQuantity: 0,
          availableQuantity: 8,
        },
      ];

      const mockLedger = {
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 5,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter: 13,
        reason: "Special bonus",
        createdBy: testCreatedBy,
        createdAt: new Date(),
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordAdjustment(dto);

      // Assert
      expect(result).toEqual(mockLedger);
      expect(result.quantity).toBe(5);
      expect(result.type).toBe("adjustment");
      expect(result.reason).toBe("Special bonus");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should successfully record negative adjustment [应该成功记录负向调整]", async () => {
      // Arrange
      const dto: IRecordAdjustmentDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -3,
        reason: "Correction",
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 10,
          consumedQuantity: 2,
          heldQuantity: 0,
          availableQuantity: 8,
        },
      ];

      const mockLedger = {
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -3,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter: 5,
        reason: "Correction",
        createdBy: testCreatedBy,
        createdAt: new Date(),
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordAdjustment(dto);

      // Assert
      expect(result).toEqual(mockLedger);
      expect(result.quantity).toBe(-3);
      expect(result.balanceAfter).toBe(5);
    });

    it("should throw error when reason is missing [当原因缺失时应该抛出错误]", async () => {
      // Arrange
      const dto: IRecordAdjustmentDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 5,
        reason: "",
        createdBy: testCreatedBy,
      };

      // Act & Assert
      await expect(serviceLedgerService.recordAdjustment(dto)).rejects.toThrow(
        ContractException,
      );
      await expect(serviceLedgerService.recordAdjustment(dto)).rejects.toThrow(
        expect.objectContaining({
          code: "LEDGER_ADJUSTMENT_REQUIRES_REASON",
        }),
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should throw error when adjustment results in negative balance [当调整导致负余额时应该抛出错误]", async () => {
      // Arrange
      const dto: IRecordAdjustmentDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -10,
        reason: "Over correction",
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 10,
          consumedQuantity: 5,
          heldQuantity: 0,
          availableQuantity: 5,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockEntitlements),
        }),
      });

      // Act & Assert
      await expect(serviceLedgerService.recordAdjustment(dto)).rejects.toThrow(
        ContractException,
      );
      await expect(serviceLedgerService.recordAdjustment(dto)).rejects.toThrow(
        expect.objectContaining({
          code: "INSUFFICIENT_BALANCE_FOR_ADJUSTMENT",
        }),
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should throw error when no entitlements found [当未找到权益时应该抛出错误]", async () => {
      // Arrange
      const dto: IRecordAdjustmentDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 5,
        reason: "Bonus",
        createdBy: testCreatedBy,
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act & Assert
      await expect(serviceLedgerService.recordAdjustment(dto)).rejects.toThrow(
        ContractNotFoundException,
      );
    });
  });

  describe("queryLedgers() [查询台账]", () => {
    it("should query ledgers by studentId [应该通过studentId查询台账]", async () => {
      // Arrange
      const mockLedgers = [
        {
          id: randomUUID(),
          studentId: testStudentId,
          serviceType: "CONSULTATION",
          quantity: -3,
          type: "consumption",
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          studentId: testStudentId,
          serviceType: "MENTORING",
          quantity: -2,
          type: "consumption",
          createdAt: new Date(),
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                offset: jest.fn().mockResolvedValue(mockLedgers),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await serviceLedgerService.queryLedgers({
        studentId: testStudentId,
      });

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(result.length).toBe(2);
    });

    it("should query ledgers by studentId and serviceType [应该通过studentId和serviceType查询台账]", async () => {
      // Arrange
      const mockLedgers = [
        {
          id: randomUUID(),
          studentId: testStudentId,
          serviceType: testServiceType,
          quantity: -3,
          type: "consumption",
          createdAt: new Date(),
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                offset: jest.fn().mockResolvedValue(mockLedgers),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await serviceLedgerService.queryLedgers({
        studentId: testStudentId,
        serviceType: testServiceType,
      });

      // Assert
      expect(result).toEqual(mockLedgers);
      expect(result.every((l) => l.serviceType === testServiceType)).toBe(true);
    });

    it("should respect limit parameter [应该遵守limit参数]", async () => {
      // Arrange
      const mockLedgers = Array.from({ length: 10 }, () => ({
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -1,
        type: "consumption",
        createdAt: new Date(),
      }));

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => ({
                offset: jest.fn().mockResolvedValue(mockLedgers.slice(0, 5)),
              })),
            })),
          })),
        }),
      });

      // Act
      const result = await serviceLedgerService.queryLedgers(
        { studentId: testStudentId },
        { limit: 5 },
      );

      // Assert
      expect(result.length).toBe(5);
    });

    it("should apply offset parameter [应该应用offset参数]", async () => {
      // Arrange
      const mockLedgers = Array.from({ length: 10 }, () => ({
        id: randomUUID(),
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -1,
        type: "consumption",
        createdAt: new Date(),
      }));

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => ({
                offset: jest.fn().mockResolvedValue(mockLedgers.slice(5, 8)),
              })),
            })),
          })),
        }),
      });

      // Act
      const result = await serviceLedgerService.queryLedgers(
        { studentId: testStudentId },
        { limit: 3, offset: 5 },
      );

      // Assert
      expect(result.length).toBe(3);
    });

    it("should throw error when no filter criteria provided [当未提供筛选条件时应该抛出错误]", async () => {
      // Act & Assert
      await expect(serviceLedgerService.queryLedgers({})).rejects.toThrow(
        ContractException,
      );
      await expect(serviceLedgerService.queryLedgers({})).rejects.toThrow(
        "At least one of studentId or serviceType is required",
      );
    });

    it("should handle date range filter [应该处理日期范围筛选]", async () => {
      // Arrange
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-12-31");
      const mockLedgers = [
        {
          id: randomUUID(),
          studentId: testStudentId,
          serviceType: testServiceType,
          quantity: -3,
          type: "consumption",
          createdAt: new Date("2025-06-01"),
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => ({
                offset: jest.fn().mockResolvedValue(mockLedgers),
              })),
            })),
          })),
        }),
      });

      // Act
      const result = await serviceLedgerService.queryLedgers({
        studentId: testStudentId,
        startDate,
        endDate,
      });

      // Assert
      expect(result).toEqual(mockLedgers);
    });
  });

  describe("reconcileBalance() [对账余额]", () => {
    it("should return true when balance is reconciled [当余额已对账时应该返回true]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 20,
          consumedQuantity: 6,
          heldQuantity: 0,
          availableQuantity: 14,
        },
      ];

      // Simple mock that returns the expected result directly
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockEntitlements),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { type: "consumption", quantity: -4 },
              { type: "consumption", quantity: -2 },
            ]),
          }),
        });

      // Act
      const result = await serviceLedgerService.reconcileBalance(
        testStudentId,
        testServiceType,
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when balance is not reconciled [当余额未对账时应该返回false]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 20,
          consumedQuantity: 6,
          heldQuantity: 0,
          availableQuantity: 14,
        },
      ];

      mockDb.select = jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockEntitlements),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where:
              jest
                .fn()
                .mockResolvedValue([{ type: "consumption", quantity: -4 }]),
          }),
        });

      // Act
      const result = await serviceLedgerService.reconcileBalance(
        testStudentId,
        testServiceType,
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should ignore adjustment entries [应该忽略调整条目]", async () => {
      // Arrange
      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          totalQuantity: 20,
          consumedQuantity: 6,
          heldQuantity: 0,
          availableQuantity: 14,
        },
      ];

      mockDb.select = jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockEntitlements),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { type: "consumption", quantity: -4 },
              { type: "adjustment", quantity: 5 },
              { type: "consumption", quantity: -2 },
            ]),
          }),
        });

      // Act
      const result = await serviceLedgerService.reconcileBalance(
        testStudentId,
        testServiceType,
      );

      // Assert
      expect(result).toBe(true); // 6 == 4 + 2, adjustment ignored
    });

    it("should throw error when no entitlements found [当未找到权益时应该抛出错误]", async () => {
      // Arrange - No entitlements found
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]), // No entitlements
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]), // No ledgers
          }),
        });

      // Act & Assert
      await expect(
        serviceLedgerService.reconcileBalance(testStudentId, testServiceType),
      ).rejects.toThrow(ContractNotFoundException);
    });
  });

  describe("recordRefund() [记录退款]", () => {
    it("should record refund successfully [应该成功记录退款]", async () => {
      // Arrange
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Mock entitlements query (first call to select)
      const mockEntitlementsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: "entitlement-1",
              studentId: testStudentId,
              serviceType: testServiceType,
              totalQuantity: 10,
              consumedQuantity: 5,
              heldQuantity: 0,
              availableQuantity: 5,
            },
          ]),
        }),
      });

      // Mock consumptions query (second call to select)
      const mockConsumptionsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            // Consumption ledgers (quantity is negative for consumption)
            { quantity: -2 },
            { quantity: -3 },
          ]),
        }),
      });

      // Mock refunds query (third call to select)
      const mockRefundsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock adjustments query (fourth call to select)
      const mockAdjustmentsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Use mockResolvedValueOnce to handle sequential calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce(mockEntitlementsSelect())
        .mockReturnValueOnce(mockConsumptionsSelect())
        .mockReturnValueOnce(mockRefundsSelect())
        .mockReturnValueOnce(mockAdjustmentsSelect());

      // Mock insert returning
      const mockLedger = {
        id: "ledger-123",
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        type: "refund",
        source: "booking_cancelled",
        balanceAfter: 7, // 5 + 2
        relatedBookingId: "booking-123",
        metadata: { bookingSource: "resumes" },
        createdBy: testStudentId,
      };

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordRefund(refundDto);

      // Assert
      expect(result).toEqual(mockLedger);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should reject non-positive refund quantity [应该拒绝非正数的退款数量]", async () => {
      // Arrange - Refund quantity of 0
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 0, // Invalid: should be positive
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Act & Assert
      await expect(
        serviceLedgerService.recordRefund(refundDto),
      ).rejects.toThrow("Refund quantity must be positive");
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("should reject negative refund quantity [应该拒绝负数的退款数量]", async () => {
      // Arrange - Refund quantity of -1
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: -1, // Invalid: should be positive
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Act & Assert
      await expect(
        serviceLedgerService.recordRefund(refundDto),
      ).rejects.toThrow("Refund quantity must be positive");
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("should throw error when no entitlements found [当未找到权益时应该抛出错误]", async () => {
      // Arrange - No entitlements found
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Act & Assert
      await expect(
        serviceLedgerService.recordRefund(refundDto),
      ).rejects.toThrow(ContractNotFoundException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should throw error when refund quantity exceeds consumed quantity [当退款数量超过已消费数量时应该抛出错误]", async () => {
      // Arrange
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 10, // More than total consumed (5)
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Mock entitlements query (first call to select)
      const mockEntitlementsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: "entitlement-1",
              studentId: testStudentId,
              serviceType: testServiceType,
              totalQuantity: 10,
              consumedQuantity: 5,
              heldQuantity: 0,
              availableQuantity: 5,
            },
          ]),
        }),
      });

      // Mock consumptions query (second call to select)
      const mockConsumptionsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { quantity: -2 },
            { quantity: -3 },
          ]),
        }),
      });

      // Mock refunds query (third call to select)
      const mockRefundsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock adjustments query (fourth call to select)
      const mockAdjustmentsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Use mockResolvedValueOnce to handle sequential calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce(mockEntitlementsSelect())
        .mockReturnValueOnce(mockConsumptionsSelect())
        .mockReturnValueOnce(mockRefundsSelect())
        .mockReturnValueOnce(mockAdjustmentsSelect());

      // Act & Assert
      await expect(
        serviceLedgerService.recordRefund(refundDto),
      ).rejects.toThrow("Refund quantity (10) exceeds net consumed quantity (5)");
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should consider previous refunds when validating quantity [验证已退款后剩余可退数量]", async () => {
      // Arrange - total consumed 5, refunded 4 => net consumed 1, refund 2 should fail
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      const mockEntitlementsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: "entitlement-1",
              studentId: testStudentId,
              serviceType: testServiceType,
              totalQuantity: 10,
              consumedQuantity: 5,
              heldQuantity: 0,
              availableQuantity: 5,
            },
          ]),
        }),
      });

      const mockConsumptionsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ quantity: -5 }]),
        }),
      });

      const mockRefundsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ quantity: 4 }]),
        }),
      });

      const mockAdjustmentsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      mockDb.select = jest.fn()
        .mockReturnValueOnce(mockEntitlementsSelect())
        .mockReturnValueOnce(mockConsumptionsSelect())
        .mockReturnValueOnce(mockRefundsSelect())
        .mockReturnValueOnce(mockAdjustmentsSelect());

      // Act & Assert
      await expect(
        serviceLedgerService.recordRefund(refundDto),
      ).rejects.toThrow("Refund quantity (2) exceeds net consumed quantity (1)");
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should require bookingSource when relatedBookingId is provided [当提供relatedBookingId时要求bookingSource]", async () => {
      // Arrange
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        relatedBookingId: "booking-123",
        bookingSource: "", // Missing bookingSource
        createdBy: testStudentId,
      };

      // Act & Assert
      await expect(
        serviceLedgerService.recordRefund(refundDto),
      ).rejects.toThrow("bookingSource is required when relatedBookingId is provided");
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should calculate balanceAfter correctly [应该正确计算balanceAfter]", async () => {
      // Arrange - available quantity is 5, refund quantity is 3, so balanceAfter should be 8
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 3,
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Mock entitlements query (first call to select)
      const mockEntitlementsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: "entitlement-1",
              studentId: testStudentId,
              serviceType: testServiceType,
              totalQuantity: 10,
              consumedQuantity: 5,
              heldQuantity: 0,
              availableQuantity: 5, // Current available is 5
            },
          ]),
        }),
      });

      // Mock consumptions query (second call to select)
      const mockConsumptionsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { quantity: -2 },
            { quantity: -4 },
          ]),
        }),
      });

      // Mock refunds query (third call to select)
      const mockRefundsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock adjustments query (fourth call to select)
      const mockAdjustmentsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Use mockResolvedValueOnce to handle sequential calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce(mockEntitlementsSelect())
        .mockReturnValueOnce(mockConsumptionsSelect())
        .mockReturnValueOnce(mockRefundsSelect())
        .mockReturnValueOnce(mockAdjustmentsSelect());

      // Mock insert returning
      const mockLedger = {
        id: "ledger-123",
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 3,
        type: "refund",
        source: "booking_cancelled",
        balanceAfter: 8, // 5 + 3
        relatedBookingId: "booking-123",
        metadata: { bookingSource: "resumes" },
        createdBy: testStudentId,
      };

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordRefund(refundDto);

      // Assert
      expect(result).toEqual(mockLedger);
      expect(result.balanceAfter).toBe(8); // 5 + 3
    });

    it("should store bookingSource in metadata [应该在metadata中存储bookingSource]", async () => {
      // Arrange
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Mock entitlements query (first call to select)
      const mockEntitlementsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: "entitlement-1",
              studentId: testStudentId,
              serviceType: testServiceType,
              totalQuantity: 10,
              consumedQuantity: 5,
              heldQuantity: 0,
              availableQuantity: 5,
            },
          ]),
        }),
      });

      // Mock consumptions query (second call to select)
      const mockConsumptionsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { quantity: -5 },
          ]),
        }),
      });

      // Mock refunds query (third call to select)
      const mockRefundsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock adjustments query (fourth call to select)
      const mockAdjustmentsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Use mockResolvedValueOnce to handle sequential calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce(mockEntitlementsSelect())
        .mockReturnValueOnce(mockConsumptionsSelect())
        .mockReturnValueOnce(mockRefundsSelect())
        .mockReturnValueOnce(mockAdjustmentsSelect());

      // Mock insert returning
      const mockLedger = {
        id: "ledger-123",
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        type: "refund",
        source: "booking_cancelled",
        balanceAfter: 6,
        relatedBookingId: "booking-123",
        metadata: { bookingSource: "resumes" },
        createdBy: testStudentId,
      };

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordRefund(refundDto);

      // Assert
      expect(result.metadata).toBeDefined();
      expect(result.metadata.bookingSource).toBe("resumes");
      // Verify insert was called
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should set correct ledger type and source [应该设置正确的账本类型和来源]", async () => {
      // Arrange
      const refundDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        relatedBookingId: "booking-123",
        bookingSource: "resumes",
        createdBy: testStudentId,
      };

      // Mock entitlements query (first call to select)
      const mockEntitlementsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: "entitlement-1",
              studentId: testStudentId,
              serviceType: testServiceType,
              totalQuantity: 10,
              consumedQuantity: 5,
              heldQuantity: 0,
              availableQuantity: 5,
            },
          ]),
        }),
      });

      // Mock consumptions query (second call to select)
      const mockConsumptionsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { quantity: -5 },
          ]),
        }),
      });

      // Mock refunds query (third call to select)
      const mockRefundsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock adjustments query (fourth call to select)
      const mockAdjustmentsSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Use mockResolvedValueOnce to handle sequential calls
      mockDb.select = jest.fn()
        .mockReturnValueOnce(mockEntitlementsSelect())
        .mockReturnValueOnce(mockConsumptionsSelect())
        .mockReturnValueOnce(mockRefundsSelect())
        .mockReturnValueOnce(mockAdjustmentsSelect());

      // Mock insert returning
      const mockLedger = {
        id: "ledger-123",
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        type: "refund",
        source: "booking_cancelled",
        createdBy: testStudentId,
      };

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // Act
      const result = await serviceLedgerService.recordRefund(refundDto);

      // Assert
      expect(result.type).toBe("refund");
      expect(result.source).toBe("booking_cancelled");
    });
  });
});
