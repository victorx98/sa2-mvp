import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ServiceLedgerService } from "./service-ledger.service";
import { ContractNotFoundException } from "../common/exceptions/contract.exception";
import { IRecordConsumptionDto } from "../interfaces/service-ledger.interface";
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

    serviceLedgerService = moduleRef.get<ServiceLedgerService>(ServiceLedgerService);
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
        "Consumption quantity must be negative"
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
        "Quantity change cannot be zero"
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
      await expect(serviceLedgerService.recordConsumption(dto)).rejects.toThrow(ContractNotFoundException);
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
        serviceLedgerService.calculateAvailableBalance(testStudentId, testServiceType),
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
});
