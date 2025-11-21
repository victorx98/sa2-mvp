import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ServiceHoldService } from "./service-hold.service";
import { ContractException, ContractNotFoundException } from "../common/exceptions/contract.exception";
import { CreateHoldDto } from "../dto/create-hold.dto";
import { HoldStatus } from "@shared/types/contract-enums";
import { randomUUID } from "crypto";

/**
 * Unit Tests for ServiceHoldService
 *
 * Test Strategy:
 * - This is a UNIT test for the domain service layer
 * - Test level: Service methods in isolation with mocked dependencies
 * - Mock external dependencies: Database
 * - Focus: Business logic validation (balance checks, hold lifecycle, expiration handling)
 * - Does NOT test: Database triggers, cron jobs, time-based expiration
 */
describe("ServiceHoldService Unit Tests [服务预占服务单元测试]", () => {
  let moduleRef: TestingModule;
  let serviceHoldService: ServiceHoldService;
  let mockDb: any;
  const testStudentId = randomUUID();
  const testServiceType = "CONSULTATION";
  const testCreatedBy = randomUUID();
  const testHoldId = randomUUID();

  // Helper function to create properly mocked transaction
  const createTransactionMock = (overrides: any = {}) => {
    const {
      forReturnValue = [],
      limitReturnValue = [],
      insertReturnValue = [],
      updateReturnValue = [],
    } = overrides;

    return {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            for: jest.fn().mockResolvedValue(forReturnValue),
            limit: jest.fn().mockResolvedValue(limitReturnValue),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue(insertReturnValue),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue(updateReturnValue),
          })),
        })),
      })),
    };
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            for: jest.fn().mockResolvedValue([]),
            limit: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
      delete: jest.fn(),
      transaction: jest.fn(async (callback) => {
        const mockTx = createTransactionMock();
        return await callback(mockTx);
      }),
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
        ServiceHoldService,
      ],
    }).compile();

    serviceHoldService = moduleRef.get<ServiceHoldService>(ServiceHoldService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createHold() [创建预占]", () => {
    it("should create hold successfully [应该成功创建预占]", async () => {
      // Arrange
      const dto: CreateHoldDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        createdBy: testCreatedBy,
        expiryAt: new Date(Date.now() + 3600000),
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
        },
      ];

      const mockHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        status: HoldStatus.ACTIVE,
        relatedBookingId: null,
        expiryAt: dto.expiryAt,
        createdBy: testCreatedBy,
      };

      const whereResult = {
        for: jest.fn().mockResolvedValue(mockEntitlements),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([mockHold]),
        })),
      }));

      // Act
      const result = await serviceHoldService.createHold(dto);

      // Assert
      expect(result).toEqual(mockHold);
      expect(result.status).toBe(HoldStatus.ACTIVE);
      expect(result.relatedBookingId).toBeNull();
      expect(result.expiryAt).toEqual(dto.expiryAt);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should create hold without expiry date [应该创建没有过期时间的预占]", async () => {
      // Arrange
      const dto: CreateHoldDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
        },
      ];

      const mockHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        status: HoldStatus.ACTIVE,
        relatedBookingId: null,
        expiryAt: null,
        createdBy: testCreatedBy,
      };

      const whereResult = {
        for: jest.fn().mockResolvedValue(mockEntitlements),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([mockHold]),
        })),
      }));

      // Act
      const result = await serviceHoldService.createHold(dto);

      // Assert
      expect(result).toEqual(mockHold);
      expect(result.expiryAt).toBeNull();
    });

    it("should throw error if insufficient balance [如果余额不足应该抛出错误]", async () => {
      // Arrange
      const dto: CreateHoldDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 10,
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
        },
      ];

      const whereResult = {
        for: jest.fn().mockResolvedValue(mockEntitlements),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      // Act & Assert
      await expect(serviceHoldService.createHold(dto)).rejects.toThrow(ContractException);
    });

    it("should throw error if no entitlements found [如果未找到权益应该抛出错误]", async () => {
      // Arrange
      const dto: CreateHoldDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        createdBy: testCreatedBy,
      };

      const whereResult = {
        for: jest.fn().mockResolvedValue([]),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      // Act & Assert
      await expect(serviceHoldService.createHold(dto)).rejects.toThrow(ContractNotFoundException);
    });

    it("should work with transaction parameter [应该支持事务参数]", async () => {
      // Arrange
      const dto: CreateHoldDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        createdBy: testCreatedBy,
        expiryAt: new Date(),
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
        },
      ];

      const mockHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 2,
        status: HoldStatus.ACTIVE,
        relatedBookingId: null,
        expiryAt: dto.expiryAt,
        createdBy: testCreatedBy,
      };

      const mockTx = createTransactionMock({
        forReturnValue: mockEntitlements,
        insertReturnValue: [mockHold],
      });

      // Act
      const result = await serviceHoldService.createHold(dto, mockTx as any);

      // Assert
      expect(result).toEqual(mockHold);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should use pessimistic lock for balance check [应该使用悲观锁检查余额]", async () => {
      // Arrange
      const dto: CreateHoldDto = {
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: 1,
        createdBy: testCreatedBy,
      };

      const mockEntitlements = [
        {
          studentId: testStudentId,
          serviceType: testServiceType,
          availableQuantity: 5,
        },
      ];

      const forSpy = jest.fn().mockResolvedValue(mockEntitlements);
      const whereResult = { for: forSpy, limit: jest.fn() };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([{ id: testHoldId }]),
        })),
      }));

      // Act
      await serviceHoldService.createHold(dto);

      // Assert
      expect(forSpy).toHaveBeenCalledWith("update");
    });
  });

  describe("releaseHold() [释放预占]", () => {
    it("should release hold successfully [应该成功释放预占]", async () => {
      // Arrange
      const mockActiveHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        status: HoldStatus.ACTIVE,
      };

      const mockReleasedHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        status: HoldStatus.RELEASED,
        releaseReason: "completed",
        releasedAt: new Date(),
        releasedBy: testCreatedBy,
      };

      const whereResult = {
        for: jest.fn(),
        limit: jest.fn().mockResolvedValue([mockActiveHold]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([mockReleasedHold]),
          })),
        })),
      }));

      // Act
      const result = await serviceHoldService.releaseHold(testHoldId, "completed");

      // Assert
      expect(result.status).toBe(HoldStatus.RELEASED);
      expect(result.releaseReason).toBe("completed");
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("cancelHold() [取消预占]", () => {
    it("should cancel hold successfully [应该成功取消预占]", async () => {
      // Arrange
      const mockActiveHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        status: HoldStatus.ACTIVE,
      };

      const mockCancelledHold = {
        id: testHoldId,
        studentId: testStudentId,
        serviceType: testServiceType,
        status: HoldStatus.RELEASED,
        releaseReason: "cancelled",
      };

      const whereResult = {
        for: jest.fn(),
        limit: jest.fn().mockResolvedValue([mockActiveHold]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([mockCancelledHold]),
          })),
        })),
      }));

      const cancellationReason = "Student cancelled booking";

      // Act
      const result = await serviceHoldService.cancelHold(testHoldId, cancellationReason);

      // Assert
      expect(result.status).toBe(HoldStatus.RELEASED);
      expect(result.releaseReason).toBe("cancelled");
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should throw error if hold not found [如果预占未找到应该抛出错误]", async () => {
      // Arrange
      const whereResult = {
        for: jest.fn(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => whereResult),
        })),
      }));

      const cancellationReason = "Test cancellation";

      // Act & Assert
      await expect(
        serviceHoldService.cancelHold("non-existent-id", cancellationReason),
      ).rejects.toThrow(ContractNotFoundException);
    });
  });

  describe("getActiveHolds() [获取活跃预占]", () => {
    it("should get all active holds for student [应该获取学生的所有活跃预占]", async () => {
      // Arrange
      const mockHolds = [
        {
          id: testHoldId,
          studentId: testStudentId,
          serviceType: testServiceType,
          quantity: 2,
          status: HoldStatus.ACTIVE,
          relatedBookingId: null,
        },
        {
          id: randomUUID(),
          studentId: testStudentId,
          serviceType: "MENTORING",
          quantity: 1,
          status: HoldStatus.ACTIVE,
          relatedBookingId: null,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockHolds),
        }),
      });

      // Act
      const result = await serviceHoldService.getActiveHolds(testStudentId);

      // Assert
      expect(result).toEqual(mockHolds);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should filter by service type [应该按服务类型过滤]", async () => {
      // Arrange
      const mockHolds = [
        {
          id: testHoldId,
          studentId: testStudentId,
          serviceType: testServiceType,
          quantity: 2,
          status: HoldStatus.ACTIVE,
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockHolds),
        }),
      });

      // Act
      const result = await serviceHoldService.getActiveHolds(testStudentId, testServiceType);

      // Assert
      expect(result).toEqual(mockHolds);
      expect(result.length).toBe(1);
    });

    it("should return empty array if no active holds [如果没有活跃预占应该返回空数组]", async () => {
      // Arrange
      const mockHolds: any[] = [];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockHolds),
        }),
      });

      // Act
      const result = await serviceHoldService.getActiveHolds(testStudentId);

      // Assert
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });
});
