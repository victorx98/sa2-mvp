import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SettlementService } from "./settlement.service";
import type { ICreateSettlementRequest } from "../dto/settlement";

/**
 * SettlementService Unit Tests (结算服务单元测试)
 *
 * Tests the business logic of SettlementService with mocked dependencies.
 * 使用模拟依赖测试 SettlementService 的业务逻辑。
 */
describe("SettlementService", () => {
  let settlementService: SettlementService;
  let mockDb: any;
  let mockEventEmitter: any;

  // [修复] 使用真实数据库中的 UUID（从查询结果中获取）
  // 真实的 mentor ID (from mentor table)
  const testMentorId = "4903b94b-67cc-42a1-9b3e-91ebc51bcefc";
  // 真实的 student ID (from student table)
  const testStudentId = "9729ec8c-ce51-43f0-85de-3b1bc410952d";
  const testSessionTypeCode = "Internal";
  const testSettlementMonth = "2024-01";

  beforeEach(async () => {
    // Mock database
    mockDb = {
      query: {
        mentorPaymentInfos: {
          findFirst: jest.fn(),
        },
        mentorPayableLedgers: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
        },
        settlementLedgers: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        settlementDetails: {
          findMany: jest.fn(),
        },
      },
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      }),
      // Add execute method mock for raw SQL queries
      execute: jest.fn().mockResolvedValue({
        rows: [],
      }),
      // [修复] Add transaction mock method [添加 transaction mock 方法]
      transaction: jest.fn(async (callback) => {
        // Create a mock transaction object that includes all query methods
        const mockTx = {
          ...mockDb,
          query: mockDb.query,
          execute: mockDb.execute,
        };
        return await callback(mockTx);
      }),
    };

    // Mock event emitter
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: "DATABASE_CONNECTION",
          useValue: mockDb,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    settlementService = moduleRef.get<SettlementService>(SettlementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateSettlement", () => {
    const mockRequest: ICreateSettlementRequest = {
      mentorId: testMentorId,
      settlementMonth: testSettlementMonth,
      exchangeRate: 7.2,
      deductionRate: 0.05,
    };

    const mockPaymentInfo = {
      id: "payment-info-id",
      mentorId: testMentorId,
      paymentCurrency: "CNY",
      paymentMethod: "DOMESTIC_TRANSFER" as const,
      paymentDetails: {
        bankName: "Test Bank",
        accountNumber: "1234567890",
        accountHolder: "Test Mentor",
      },
      status: "ACTIVE" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: testMentorId,
      updatedBy: testMentorId,
    };

    const mockPayableLedgers = [
      {
        id: "ledger-1",
        mentorId: testMentorId,
        studentId: testStudentId,
        referenceId: "session-1",
        sessionTypeCode: testSessionTypeCode,
        price: "100.0",
        amount: "100.00",
        currency: "USD",
        createdBy: testMentorId,
        createdAt: new Date(),
      },
      {
        id: "ledger-2",
        mentorId: testMentorId,
        studentId: testStudentId,
        referenceId: "session-2",
        sessionTypeCode: testSessionTypeCode,
        price: "150.0",
        amount: "150.00",
        currency: "USD",
        createdBy: testMentorId,
        createdAt: new Date(),
      },
    ];

    const mockSettlement = {
      id: "settlement-id",
      mentorId: testMentorId,
      settlementMonth: testSettlementMonth,
      originalAmount: "250.00",
      targetAmount: "1710.00",
      originalCurrency: "USD",
      targetCurrency: "CNY",
      exchangeRate: "7.2",
      deductionRate: "0.05",
      status: "CONFIRMED" as const,
      settlementMethod: "DOMESTIC_TRANSFER" as const,
      mentorPaymentInfoId: "payment-info-id",
      paymentReference: null,
      createdAt: new Date(),
      createdBy: testMentorId,
    };

    beforeEach(() => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(
        mockPaymentInfo,
      );
      mockDb.execute.mockResolvedValue({ rows: mockPayableLedgers });
      mockDb.insert().returning.mockResolvedValue([mockSettlement]);
    });

    it("should successfully generate a settlement", async () => {
      const result = await settlementService.generateSettlement(
        mockRequest,
        testMentorId,
      );

      expect(mockDb.query.mentorPaymentInfos.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
      expect(mockDb.execute).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "financial.settlement.confirmed",
        expect.objectContaining({
          type: "financial.settlement.confirmed",
          payload: expect.any(Object),
          timestamp: expect.any(Number),
          source: expect.objectContaining({
            domain: "financial",
            service: "SettlementService",
          }),
        }),
      );

      expect(result).toMatchObject({
        id: mockSettlement.id,
        mentorId: testMentorId,
        settlementMonth: testSettlementMonth,
        originalAmount: 250,
        targetAmount: 1710,
        exchangeRate: 7.2,
        deductionRate: 0.05,
        createdBy: testMentorId,
      });
    });

    it("should fail if mentorId is missing", async () => {
      const invalidRequest = { ...mockRequest, mentorId: "" };

      await expect(
        settlementService.generateSettlement(invalidRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if settlementMonth is missing", async () => {
      const invalidRequest = { ...mockRequest, settlementMonth: "" };

      await expect(
        settlementService.generateSettlement(invalidRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if settlementMonth format is invalid", async () => {
      const invalidRequest = { ...mockRequest, settlementMonth: "2024/01" };

      await expect(
        settlementService.generateSettlement(invalidRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if exchangeRate is not greater than 0", async () => {
      const invalidRequest = { ...mockRequest, exchangeRate: 0 };

      await expect(
        settlementService.generateSettlement(invalidRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if deductionRate is negative", async () => {
      const invalidRequest = { ...mockRequest, deductionRate: -0.1 };

      await expect(
        settlementService.generateSettlement(invalidRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if deductionRate is greater than 1", async () => {
      const invalidRequest = { ...mockRequest, deductionRate: 1.5 };

      await expect(
        settlementService.generateSettlement(invalidRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if mentor has no active payment info", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      await expect(
        settlementService.generateSettlement(mockRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if settlement already exists", async () => {
      mockDb.query.settlementLedgers.findFirst.mockResolvedValueOnce({
        id: "existing-settlement-id",
      });

      await expect(
        settlementService.generateSettlement(mockRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if no payable ledgers exist", async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      await expect(
        settlementService.generateSettlement(mockRequest, testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if settlement creation fails", async () => {
      mockDb.insert().returning.mockResolvedValue([]);

      await expect(
        settlementService.generateSettlement(mockRequest, testMentorId),
      ).rejects.toThrow("Failed to create settlement record");
    });

    it("should calculate correct amounts with exchange rate and deduction", async () => {
      const result = await settlementService.generateSettlement(
        mockRequest,
        testMentorId,
      );

      // Original: 100 + 150 = 250
      // After deduction (5%): 250 * 0.95 = 237.5
      // After exchange (7.2): 237.5 * 7.2 = 1710
      expect(result.originalAmount).toBe(250);
      expect(result.targetAmount).toBe(1710);
    });

    it("should publish settlement confirmed event with correct payload", async () => {
      await settlementService.generateSettlement(mockRequest, testMentorId);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "financial.settlement.confirmed",
        expect.objectContaining({
          type: "financial.settlement.confirmed",
          payload: expect.objectContaining({
            settlementId: mockSettlement.id,
            mentorId: testMentorId,
            settlementMonth: testSettlementMonth,
            originalAmount: 250,
            targetAmount: 1710,
            exchangeRate: 7.2,
            deductionRate: 0.05,
            createdBy: testMentorId,
            payableLedgerIds: ["ledger-1", "ledger-2"],
          }),
        }),
      );
    });
  });

  describe("getSettlementById", () => {
    it("should return settlement when found", async () => {
      const mockSettlement = {
        id: "settlement-id",
        mentorId: testMentorId,
        settlementMonth: testSettlementMonth,
        originalAmount: "250.00",
        targetAmount: "1710.00",
        originalCurrency: "USD",
        targetCurrency: "CNY",
        exchangeRate: "7.2",
        deductionRate: "0.05",
        settlementMethod: "DOMESTIC_TRANSFER" as const,
        paymentReference: null,
        createdAt: new Date(),
        createdBy: testMentorId,
      };

      mockDb.query.settlementLedgers.findFirst.mockResolvedValue(
        mockSettlement,
      );

      const result = await settlementService.getSettlementById("settlement-id");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("settlement-id");
      expect(result?.originalAmount).toBe(250);
      expect(result?.targetAmount).toBe(1710);
    });

    it("should return null when settlement not found", async () => {
      mockDb.query.settlementLedgers.findFirst.mockResolvedValue(null);

      const result =
        await settlementService.getSettlementById("non-existent-id");

      expect(result).toBeNull();
    });

    it("should throw error when database query fails", async () => {
      const dbError = new Error("Database error");
      mockDb.query.settlementLedgers.findFirst.mockRejectedValue(dbError);

      await expect(
        settlementService.getSettlementById("settlement-id"),
      ).rejects.toThrow("Database error");
    });
  });

  describe("getSettlementByMentorAndMonth", () => {
    it("should return settlement when found", async () => {
      const mockSettlement = {
        id: "settlement-id",
        mentorId: testMentorId,
        settlementMonth: testSettlementMonth,
        originalAmount: "250.00",
        targetAmount: "1710.00",
        originalCurrency: "USD",
        targetCurrency: "CNY",
        exchangeRate: "7.2",
        deductionRate: "0.05",
        settlementMethod: "DOMESTIC_TRANSFER" as const,
        paymentReference: null,
        createdAt: new Date(),
        createdBy: testMentorId,
      };

      mockDb.query.settlementLedgers.findFirst.mockResolvedValue(
        mockSettlement,
      );

      const result = await settlementService.getSettlementByMentorAndMonth(
        testMentorId,
        testSettlementMonth,
      );

      expect(result).not.toBeNull();
      expect(result?.mentorId).toBe(testMentorId);
      expect(result?.settlementMonth).toBe(testSettlementMonth);
    });

    it("should return null when settlement not found", async () => {
      mockDb.query.settlementLedgers.findFirst.mockResolvedValue(null);

      const result = await settlementService.getSettlementByMentorAndMonth(
        testMentorId,
        testSettlementMonth,
      );

      expect(result).toBeNull();
    });

    it("should throw error when database query fails", async () => {
      const dbError = new Error("Database error");
      mockDb.query.settlementLedgers.findFirst.mockRejectedValue(dbError);

      await expect(
        settlementService.getSettlementByMentorAndMonth(
          testMentorId,
          testSettlementMonth,
        ),
      ).rejects.toThrow("Database error");
    });
  });

  describe("findSettlements", () => {
    it("should return paginated results", async () => {
      const mockSettlements = [
        {
          id: "settlement-1",
          mentorId: testMentorId,
          settlementMonth: "2024-01",
          originalAmount: "100.00",
          targetAmount: "720.00",
          originalCurrency: "USD",
          targetCurrency: "CNY",
          exchangeRate: "7.2",
          deductionRate: "0.05",
          settlementMethod: "DOMESTIC_TRANSFER" as const,
          createdAt: new Date(),
        },
        {
          id: "settlement-2",
          mentorId: testMentorId,
          settlementMonth: "2024-02",
          originalAmount: "200.00",
          targetAmount: "1440.00",
          originalCurrency: "USD",
          targetCurrency: "CNY",
          exchangeRate: "7.2",
          deductionRate: "0.05",
          settlementMethod: "DOMESTIC_TRANSFER" as const,
          createdAt: new Date(),
        },
      ];

      mockDb.query.settlementLedgers.findMany.mockResolvedValue(
        mockSettlements,
      );
      mockDb.select().from().where = jest
        .fn()
        .mockReturnValue([{ count: "2" }]) as any;

      const result = await settlementService.findSettlements({
        page: 1,
        pageSize: 10,
      });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].originalAmount).toBe(100);
      expect(result.data[1].originalAmount).toBe(200);
    });

    it("should apply mentor filter", async () => {
      mockDb.query.settlementLedgers.findMany.mockResolvedValue([]);
      mockDb.select().from().where = jest
        .fn()
        .mockReturnValue([{ count: "0" }]) as any;

      await settlementService.findSettlements({
        mentorId: testMentorId,
        page: 1,
        pageSize: 10,
      });

      expect(mockDb.query.settlementLedgers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
        }),
      );
    });

    it("should apply month filter", async () => {
      mockDb.query.settlementLedgers.findMany.mockResolvedValue([]);
      mockDb.select().from().where = jest
        .fn()
        .mockReturnValue([{ count: "0" }]) as any;

      await settlementService.findSettlements({
        settlementMonth: testSettlementMonth,
        page: 1,
        pageSize: 10,
      });

      expect(mockDb.query.settlementLedgers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
        }),
      );
    });

    it("should validate startDate format", async () => {
      await expect(
        settlementService.findSettlements({
          startDate: "invalid-date",
          page: 1,
          pageSize: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should validate endDate format", async () => {
      await expect(
        settlementService.findSettlements({
          endDate: "invalid-date",
          page: 1,
          pageSize: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should apply date range filter", async () => {
      mockDb.query.settlementLedgers.findMany.mockResolvedValue([]);
      mockDb.select().from().where = jest
        .fn()
        .mockReturnValue([{ count: "0" }]) as any;

      await settlementService.findSettlements({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        page: 1,
        pageSize: 10,
      });

      expect(mockDb.query.settlementLedgers.findMany).toHaveBeenCalled();
    });

    it("should throw error when database query fails", async () => {
      const dbError = new Error("Database error");
      mockDb.select().from().where = jest.fn().mockRejectedValue(dbError);

      await expect(
        settlementService.findSettlements({
          page: 1,
          pageSize: 10,
        }),
      ).rejects.toThrow("Database error");
    });
  });

  describe("getSettlementDetails", () => {
    it("should return settlement details", async () => {
      const mockDetails = [
        {
          id: "detail-1",
          settlementId: "settlement-id",
          mentorPayableId: "ledger-1",
          createdAt: new Date(),
          createdBy: testMentorId,
        },
        {
          id: "detail-2",
          settlementId: "settlement-id",
          mentorPayableId: "ledger-2",
          createdAt: new Date(),
          createdBy: testMentorId,
        },
      ];

      mockDb.query.settlementDetails.findMany.mockResolvedValue(mockDetails);

      const result =
        await settlementService.getSettlementDetails("settlement-id");

      expect(result).toHaveLength(2);
      expect(result[0].settlementId).toBe("settlement-id");
      expect(result[0].mentorPayableId).toBe("ledger-1");
    });

    it("should throw error when database query fails", async () => {
      const dbError = new Error("Database error");
      mockDb.query.settlementDetails.findMany.mockRejectedValue(dbError);

      await expect(
        settlementService.getSettlementDetails("settlement-id"),
      ).rejects.toThrow("Database error");
    });
  });
});
