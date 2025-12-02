import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { MentorPaymentInfoService } from "./mentor-payment-info.service";
import type { ICreateOrUpdateMentorPaymentInfoRequest } from "../dto/settlement";
import { SettlementMethod } from "../dto/settlement/settlement.enums";

/**
 * MentorPaymentInfoService Unit Tests (导师支付信息服务单元测试)
 *
 * Tests the business logic of MentorPaymentInfoService with mocked dependencies.
 * 使用模拟依赖测试 MentorPaymentInfoService 的业务逻辑。
 */
describe("MentorPaymentInfoService", () => {
  let paymentInfoService: MentorPaymentInfoService;
  let mockDb: any;

  const testMentorId = "test-mentor-id";

  beforeEach(async () => {
    // Mock database
    mockDb = {
      query: {
        mentorPaymentInfos: {
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
        MentorPaymentInfoService,
        {
          provide: "DATABASE_CONNECTION",
          useValue: mockDb,
        },
      ],
    }).compile();

    paymentInfoService = moduleRef.get<MentorPaymentInfoService>(
      MentorPaymentInfoService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createOrUpdateMentorPaymentInfo", () => {
    const mockRequest: ICreateOrUpdateMentorPaymentInfoRequest = {
      mentorId: testMentorId,
      paymentCurrency: "USD",
      paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
      paymentDetails: {
        bankName: "Test Bank",
        accountNumber: "1234567890",
        accountHolder: "Test Mentor",
      },
    };

    const mockPaymentInfo = {
      id: "payment-info-id",
      mentorId: testMentorId,
      paymentCurrency: "USD",
      paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
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

    beforeEach(() => {
      mockDb.insert().returning.mockResolvedValue([mockPaymentInfo]);
      mockDb.update().returning.mockResolvedValue([mockPaymentInfo]);
    });

    it("should create new payment info when none exists", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        mockRequest,
      );

      expect(mockDb.query.mentorPaymentInfos.findFirst).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe(mockPaymentInfo.id);
      expect(result.mentorId).toBe(testMentorId);
    });

    it("should update existing payment info", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(
        mockPaymentInfo,
      );

      const updatedRequest = {
        ...mockRequest,
        paymentDetails: {
          bankName: "Updated Bank",
          accountNumber: "0987654321",
          accountHolder: "Updated Mentor",
        },
      };

      mockDb.update().returning.mockResolvedValue([
        {
          ...mockPaymentInfo,
          paymentDetails: updatedRequest.paymentDetails,
        },
      ]);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        updatedRequest,
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(result.paymentDetails.bankName).toBe("Updated Bank");
    });

    it("should fail if mentorId is missing", async () => {
      const invalidRequest = { ...mockRequest, mentorId: "" };

      await expect(
        paymentInfoService.createOrUpdateMentorPaymentInfo(invalidRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if paymentCurrency is missing", async () => {
      const invalidRequest = { ...mockRequest, paymentCurrency: "" };

      await expect(
        paymentInfoService.createOrUpdateMentorPaymentInfo(invalidRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if paymentMethod is missing", async () => {
      const invalidRequest = { ...mockRequest, paymentMethod: "" as any };

      await expect(
        paymentInfoService.createOrUpdateMentorPaymentInfo(invalidRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if paymentDetails is empty", async () => {
      const invalidRequest = { ...mockRequest, paymentDetails: {} as any };

      await expect(
        paymentInfoService.createOrUpdateMentorPaymentInfo(invalidRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle DOMESTIC_TRANSFER payment method", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        mockRequest,
      );

      expect(result.paymentMethod).toBe("DOMESTIC_TRANSFER");
    });

    it("should handle GUSTO payment method", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const gustoRequest = {
        ...mockRequest,
        paymentMethod: SettlementMethod.GUSTO as const,
        paymentDetails: {
          employeeId: "EMP123",
          companyId: "COMP456",
        },
      };

      const mockGustoInfo = {
        ...mockPaymentInfo,
        paymentMethod: SettlementMethod.GUSTO as const,
        paymentDetails: gustoRequest.paymentDetails,
      };

      mockDb.insert().returning.mockResolvedValue([mockGustoInfo]);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        gustoRequest,
      );

      expect(result.paymentMethod).toBe("GUSTO");
      expect(result.paymentDetails.employeeId).toBe("EMP123");
    });

    it("should handle CHECK payment method", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const checkRequest = {
        ...mockRequest,
        paymentMethod: SettlementMethod.CHECK as const,
        paymentDetails: {
          payee: "John Doe",
          address: "123 Main St",
        },
      };

      const mockCheckInfo = {
        ...mockPaymentInfo,
        paymentMethod: SettlementMethod.CHECK as const,
        paymentDetails: checkRequest.paymentDetails,
      };

      mockDb.insert().returning.mockResolvedValue([mockCheckInfo]);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        checkRequest,
      );

      expect(result.paymentMethod).toBe("CHECK");
      expect(result.paymentDetails.payee).toBe("John Doe");
    });

    it("should handle CHANNEL_BATCH_PAY payment method", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const channelRequest = {
        ...mockRequest,
        paymentMethod: SettlementMethod.CHANNEL_BATCH_PAY as const,
        paymentDetails: {
          channelId: "CH123",
          channelName: "Test Channel",
        },
      };

      const mockChannelInfo = {
        ...mockPaymentInfo,
        paymentMethod: SettlementMethod.CHANNEL_BATCH_PAY as const,
        paymentDetails: channelRequest.paymentDetails,
      };

      mockDb.insert().returning.mockResolvedValue([mockChannelInfo]);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        channelRequest,
      );

      expect(result.paymentMethod).toBe("CHANNEL_BATCH_PAY");
      expect(result.paymentDetails.channelId).toBe("CH123");
    });

    it("should handle GUSTO_INTERNATIONAL payment method", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const gustoIntlRequest = {
        ...mockRequest,
        paymentMethod: SettlementMethod.GUSTO_INTERNATIONAL as const,
        paymentDetails: {
          employeeId: "EMP789",
          companyId: "COMP012",
        },
      };

      const mockGustoIntlInfo = {
        ...mockPaymentInfo,
        paymentMethod: SettlementMethod.GUSTO_INTERNATIONAL as const,
        paymentDetails: gustoIntlRequest.paymentDetails,
      };

      mockDb.insert().returning.mockResolvedValue([mockGustoIntlInfo]);

      const result = await paymentInfoService.createOrUpdateMentorPaymentInfo(
        gustoIntlRequest,
      );

      expect(result.paymentMethod).toBe("GUSTO_INTERNATIONAL");
      expect(result.paymentDetails.employeeId).toBe("EMP789");
    });
  });

  describe("getMentorPaymentInfo", () => {
    const mockPaymentInfo = {
      id: "payment-info-id",
      mentorId: testMentorId,
      paymentCurrency: "USD",
      paymentMethod: SettlementMethod.DOMESTIC_TRANSFER as const,
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

    it("should return payment info when found", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.getMentorPaymentInfo(testMentorId);

      expect(result).not.toBeNull();
      expect(result?.mentorId).toBe(testMentorId);
      expect(result?.status).toBe("ACTIVE");
      expect(mockDb.query.mentorPaymentInfos.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
    });

    it("should return null when payment info not found", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const result = await paymentInfoService.getMentorPaymentInfo(testMentorId);

      expect(result).toBeNull();
    });

    it("should fail if mentorId is missing", async () => {
      await expect(paymentInfoService.getMentorPaymentInfo("")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateStatus", () => {
    const mockPaymentInfo = {
      id: "payment-info-id",
      mentorId: testMentorId,
      paymentCurrency: "USD",
      paymentMethod: SettlementMethod.DOMESTIC_TRANSFER as const,
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

    beforeEach(() => {
      mockDb.update().returning.mockResolvedValue([mockPaymentInfo]);
    });

    it("should update status to INACTIVE", async () => {
      const updatedInfo = { ...mockPaymentInfo, status: "INACTIVE" as const };
      mockDb.update().returning.mockResolvedValue([updatedInfo]);

      const result = await paymentInfoService.updateStatus(
        "payment-info-id",
        "INACTIVE",
        testMentorId,
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(result.status).toBe("INACTIVE");
    });

    it("should update status to ACTIVE", async () => {
      const result = await paymentInfoService.updateStatus(
        "payment-info-id",
        "ACTIVE",
        testMentorId,
      );

      expect(result.status).toBe("ACTIVE");
    });

    it("should fail if status is not ACTIVE or INACTIVE", async () => {
      await expect(
        paymentInfoService.updateStatus(
          "payment-info-id",
          "INVALID" as any,
          testMentorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail if payment info ID is missing", async () => {
      await expect(
        paymentInfoService.updateStatus("", "ACTIVE", testMentorId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if payment info not found", async () => {
      mockDb.update().returning.mockResolvedValue([]);

      await expect(
        paymentInfoService.updateStatus("non-existent-id", "INACTIVE", testMentorId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("validateMentorPaymentInfo", () => {
    it("should return false if mentorId is empty", async () => {
      const result = await paymentInfoService.validateMentorPaymentInfo("");

      expect(result).toBe(false);
    });

    it("should return false if no payment info exists", async () => {
      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(null);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(false);
    });

    it("should validate DOMESTIC_TRANSFER details", async () => {
      const mockPaymentInfo = {
        id: "payment-info-id",
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER as const,
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

      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(true);
    });

    it("should return false for invalid DOMESTIC_TRANSFER details", async () => {
      const mockPaymentInfo = {
        id: "payment-info-id",
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER as const,
        paymentDetails: {
          bankName: "Test Bank",
          // Missing accountNumber and accountHolder
        },
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: testMentorId,
        updatedBy: testMentorId,
      };

      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(false);
    });

    it("should validate GUSTO details", async () => {
      const mockPaymentInfo = {
        id: "payment-info-id",
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.GUSTO as const,
        paymentDetails: {
          employeeId: "EMP123",
          companyId: "COMP456",
        },
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: testMentorId,
        updatedBy: testMentorId,
      };

      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(true);
    });

    it("should return false for invalid GUSTO details", async () => {
      const mockPaymentInfo = {
        id: "payment-info-id",
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.GUSTO as const,
        paymentDetails: {
          employeeId: "EMP123",
          // Missing companyId
        },
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: testMentorId,
        updatedBy: testMentorId,
      };

      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(false);
    });

    it("should return false if paymentDetails is not an object", async () => {
      const mockPaymentInfo = {
        id: "payment-info-id",
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER as const,
        paymentDetails: "invalid" as any,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: testMentorId,
        updatedBy: testMentorId,
      };

      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(false);
    });

    it("should return false for unknown payment method", async () => {
      const mockPaymentInfo = {
        id: "payment-info-id",
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: "UNKNOWN" as any,
        paymentDetails: {},
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: testMentorId,
        updatedBy: testMentorId,
      };

      mockDb.query.mentorPaymentInfos.findFirst.mockResolvedValue(mockPaymentInfo);

      const result = await paymentInfoService.validateMentorPaymentInfo(testMentorId);

      expect(result).toBe(false);
    });
  });
});
