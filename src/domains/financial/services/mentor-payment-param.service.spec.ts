import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MentorPaymentParamService } from "./mentor-payment-param.service";
import type { PaymentParamUpdateRequestDto } from "@api/dto/request/financial/settlement.request.dto";

/**
 * MentorPaymentParamService Unit Tests (导师支付参数服务单元测试)
 *
 * Tests the business logic of MentorPaymentParamService with mocked dependencies.
 * 使用模拟依赖测试 MentorPaymentParamService 的业务逻辑。
 */
describe("MentorPaymentParamService", () => {
  let paymentParamService: MentorPaymentParamService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock database
    mockDb = {
      query: {
        paymentParams: {
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MentorPaymentParamService,
        {
          provide: "DATABASE_CONNECTION",
          useValue: mockDb,
        },
      ],
    }).compile();

    paymentParamService = moduleRef.get<MentorPaymentParamService>(
      MentorPaymentParamService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("updateOrCreateDefaultParams", () => {
    const mockParams: PaymentParamUpdateRequestDto = {
      defaultExchangeRate: 7.2,
      defaultDeductionRate: 0.05,
    };

    const mockPaymentParams = {
      id: "param-id",
      currency: "USD",
      settlementMonth: "2024-01",
      defaultExchangeRate: "7.0",
      defaultDeductionRate: "0.04",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "user-1",
      updatedBy: "user-1",
    };

    beforeEach(() => {
      mockDb.insert().returning.mockResolvedValue([mockPaymentParams]);
      mockDb.update().returning.mockResolvedValue([mockPaymentParams]);
    });

    it("should create new payment parameters when none exist", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(null);

      await paymentParamService.updateOrCreateDefaultParams(
        "USD",
        "2024-01",
        mockParams,
        "user-1",
      );

      expect(mockDb.query.paymentParams.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should update existing payment parameters", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await paymentParamService.updateOrCreateDefaultParams(
        "USD",
        "2024-01",
        mockParams,
        "user-1",
      );

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should validate currency code format", async () => {
      await expect(
        paymentParamService.updateOrCreateDefaultParams(
          "INVALID",
          "2024-01",
          mockParams,
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should validate settlement month format", async () => {
      await expect(
        paymentParamService.updateOrCreateDefaultParams(
          "USD",
          "2024/01",
          mockParams,
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if exchange rate is invalid", async () => {
      const invalidParams = { ...mockParams, defaultExchangeRate: -1 };

      await expect(
        paymentParamService.updateOrCreateDefaultParams(
          "USD",
          "2024-01",
          invalidParams,
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if deduction rate is negative", async () => {
      const invalidParams = { ...mockParams, defaultDeductionRate: -0.1 };

      await expect(
        paymentParamService.updateOrCreateDefaultParams(
          "USD",
          "2024-01",
          invalidParams,
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if deduction rate is greater than 1", async () => {
      const invalidParams = { ...mockParams, defaultDeductionRate: 1.5 };

      await expect(
        paymentParamService.updateOrCreateDefaultParams(
          "USD",
          "2024-01",
          invalidParams,
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should accept as settlement month", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(null);

      await paymentParamService.updateOrCreateDefaultParams(
        "USD",
        "2025-12",
        mockParams,
        "user-1",
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle CNY currency", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(null);

      await paymentParamService.updateOrCreateDefaultParams(
        "CNY",
        "2024-01",
        mockParams,
        "user-1",
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle EUR currency", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(null);

      await paymentParamService.updateOrCreateDefaultParams(
        "EUR",
        "2024-01",
        mockParams,
        "user-1",
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("modifyDefaultParams", () => {
    const mockPaymentParams = {
      id: "param-id",
      currency: "USD",
      settlementMonth: "2024-01",
      defaultExchangeRate: "7.0",
      defaultDeductionRate: "0.04",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "user-1",
      updatedBy: "user-1",
    };

    beforeEach(() => {
      mockDb.update().returning.mockResolvedValue([mockPaymentParams]);
    });

    it("should modify existing parameters", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await paymentParamService.modifyDefaultParams(
        "USD",
        "2024-01",
        {
          defaultExchangeRate: 7.5,
          defaultDeductionRate: 0.06,
        },
        "user-2",
      );

      expect(mockDb.query.paymentParams.findFirst).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should support partial updates (exchange rate only)", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await paymentParamService.modifyDefaultParams(
        "USD",
        "2024-01",
        {
          defaultExchangeRate: 7.5,
        },
        "user-2",
      );

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should support partial updates (deduction rate only)", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await paymentParamService.modifyDefaultParams(
        "USD",
        "2024-01",
        {
          defaultDeductionRate: 0.06,
        },
        "user-2",
      );

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should fail if parameters do not exist", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(null);

      await expect(
        paymentParamService.modifyDefaultParams(
          "USD",
          "2024-01",
          {
            defaultExchangeRate: 7.5,
          },
          "user-2",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if exchange rate is invalid", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await expect(
        paymentParamService.modifyDefaultParams(
          "USD",
          "2024-01",
          {
            defaultExchangeRate: -1,
          },
          "user-2",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if deduction rate is negative", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await expect(
        paymentParamService.modifyDefaultParams(
          "USD",
          "2024-01",
          {
            defaultDeductionRate: -0.1,
          },
          "user-2",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if deduction rate is greater than 1", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      await expect(
        paymentParamService.modifyDefaultParams(
          "USD",
          "2024-01",
          {
            defaultDeductionRate: 1.5,
          },
          "user-2",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getDefaultParams", () => {
    it("should return parameters when found", async () => {
      const mockPaymentParams = {
        id: "param-id",
        currency: "USD",
        settlementMonth: "2024-01",
        defaultExchangeRate: "7.2",
        defaultDeductionRate: "0.05",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user-1",
        updatedBy: "user-1",
      };

      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      const result = await paymentParamService.getDefaultParams(
        "USD",
        "2024-01",
      );

      expect(result).not.toBeNull();
      expect(result?.currency).toBe("USD");
      expect(result?.settlementMonth).toBe("2024-01");
      expect(result?.defaultExchangeRate).toBe(7.2);
      expect(result?.defaultDeductionRate).toBe(0.05);
    });

    it("should return null when parameters not found", async () => {
      mockDb.query.paymentParams.findFirst.mockResolvedValue(null);

      const result = await paymentParamService.getDefaultParams(
        "USD",
        "2024-01",
      );

      expect(result).toBeNull();
    });

    it("should return null for invalid currency", async () => {
      const result = await paymentParamService.getDefaultParams(
        "INVALID",
        "2024-01",
      );

      expect(result).toBeNull();
    });

    it("should return null for invalid month format", async () => {
      const result = await paymentParamService.getDefaultParams(
        "USD",
        "2024/01",
      );

      expect(result).toBeNull();
    });

    it("should handle CNY currency", async () => {
      const mockPaymentParams = {
        id: "param-id",
        currency: "CNY",
        settlementMonth: "2024-01",
        defaultExchangeRate: "1.0",
        defaultDeductionRate: "0.05",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user-1",
        updatedBy: "user-1",
      };

      mockDb.query.paymentParams.findFirst.mockResolvedValue(mockPaymentParams);

      const result = await paymentParamService.getDefaultParams(
        "CNY",
        "2024-01",
      );

      expect(result?.currency).toBe("CNY");
      expect(result?.defaultExchangeRate).toBe(1.0);
    });
  });

  describe("validateParams", () => {
    it("should return true for valid parameters", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: 7.2,
        defaultDeductionRate: 0.05,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(true);
    });

    it("should return false if exchange rate is missing", () => {
      const params = {
        defaultDeductionRate: 0.05,
      } as PaymentParamUpdateRequestDto;

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if exchange rate is not a number", () => {
      const params = {
        defaultExchangeRate: "invalid" as any,
        defaultDeductionRate: 0.05,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if exchange rate is 0", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: 0,
        defaultDeductionRate: 0.05,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if exchange rate is negative", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: -1,
        defaultDeductionRate: 0.05,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if deduction rate is missing", () => {
      const params = {
        defaultExchangeRate: 7.2,
      } as PaymentParamUpdateRequestDto;

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if deduction rate is not a number", () => {
      const params = {
        defaultExchangeRate: 7.2,
        defaultDeductionRate: "invalid" as any,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if deduction rate is negative", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: 7.2,
        defaultDeductionRate: -0.1,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return false if deduction rate is greater than 1", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: 7.2,
        defaultDeductionRate: 1.5,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(false);
    });

    it("should return true for valid minimum values", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: 0.01,
        defaultDeductionRate: 0.0,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(true);
    });

    it("should return true for valid maximum deduction rate", () => {
      const params: PaymentParamUpdateRequestDto = {
        defaultExchangeRate: 1.0,
        defaultDeductionRate: 1.0,
      };

      const result = paymentParamService.validateParams(params);

      expect(result).toBe(true);
    });
  });
});
