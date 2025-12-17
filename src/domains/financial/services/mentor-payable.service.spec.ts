import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MentorPayableService } from "./mentor-payable.service";
import { MentorPriceService } from "./mentor-price.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

describe("MentorPayableService", () => {
  let service: MentorPayableService;
  let mockDb: any;
  let mockMentorPriceService: jest.Mocked<MentorPriceService>;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      // [修复] Add transaction method for testing concurrent adjustment fix
      transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockDb);
      }),
      execute: jest.fn(),
      query: {
        mentorPayableLedgers: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
    };

    mockMentorPriceService = {
      getMentorPrice: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorPayableService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: MentorPriceService,
          useValue: mockMentorPriceService,
        },
      ],
    }).compile();

    service = module.get<MentorPayableService>(MentorPayableService);
  });

  describe("createPerSessionBilling", () => {
    const validPayload = {
      sessionId: "session-123",
      studentId: "student-123",
      mentorId: "mentor-123",
      sessionTypeCode: "consultation",
      actualDurationHours: 2,
      durationHours: 2,
      allowBilling: true,
    };

    const mockMentorPrice = {
      id: "price-123",
      mentorUserId: "mentor-123", // Changed from mentorId to mentorUserId
      sessionTypeCode: "consultation",
      price: "100",
      currency: "USD",
      status: "active",
      updatedBy: null,
      serviceTypeId: null,
      packageCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should create per-session billing successfully", async () => {
      mockMentorPriceService.getMentorPrice.mockResolvedValue(mockMentorPrice);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      await service.createPerSessionBilling(validPayload);

      expect(mockMentorPriceService.getMentorPrice).toHaveBeenCalledWith(
        "mentor-123",
        "consultation",
      );
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error when sessionId is missing", async () => {
      const invalidPayload = { ...validPayload, sessionId: undefined };
      await expect(
        service.createPerSessionBilling(invalidPayload as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when studentId is missing", async () => {
      const invalidPayload = { ...validPayload, studentId: undefined };
      await expect(
        service.createPerSessionBilling(invalidPayload as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when mentorId is missing", async () => {
      const invalidPayload = { ...validPayload, mentorId: undefined };
      await expect(
        service.createPerSessionBilling(invalidPayload as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when sessionTypeCode is missing", async () => {
      const invalidPayload = { ...validPayload, sessionTypeCode: undefined };
      await expect(
        service.createPerSessionBilling(invalidPayload as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should skip billing when allowBilling is false", async () => {
      const payload = { ...validPayload, allowBilling: false };
      await service.createPerSessionBilling(payload);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should throw error when mentor price not found", async () => {
      mockMentorPriceService.getMentorPrice.mockResolvedValue(null);
      await expect(
        service.createPerSessionBilling(validPayload),
      ).rejects.toThrow(BadRequestException);
    });

    it("should use refrenceId if provided", async () => {
      mockMentorPriceService.getMentorPrice.mockResolvedValue(mockMentorPrice);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const payload = { ...validPayload, refrenceId: "custom-ref-id" };
      await service.createPerSessionBilling(payload);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("isDuplicate", () => {
    it("should return false for empty referenceId", async () => {
      const result = await service.isDuplicate("");
      expect(result).toBe(false);
    });

    it("should return false when no duplicate exists", async () => {
      mockDb.query.mentorPayableLedgers.findFirst.mockResolvedValue(null);
      const result = await service.isDuplicate("ref-123");
      expect(result).toBe(false);
    });

    it("should throw error when database query fails", async () => {
      const dbError = new Error("Database error");
      mockDb.query.mentorPayableLedgers.findFirst.mockRejectedValue(dbError);

      await expect(service.isDuplicate("ref-123")).rejects.toThrow(
        "Database error",
      );
    });

    it("should return true when duplicate exists", async () => {
      mockDb.query.mentorPayableLedgers.findFirst.mockResolvedValue({
        id: "ledger-123",
      });
      const result = await service.isDuplicate("ref-123");
      expect(result).toBe(true);
    });
  });

  describe("getMentorPrice", () => {
    it("should proxy to MentorPriceService", async () => {
      const mockPrice = {
        id: "price-123",
        status: "active",
        updatedBy: "user-123",
        mentorUserId: "mentor-123", // Changed from mentorId to mentorUserId
        serviceTypeId: "service-type-123",
        sessionTypeCode: "consultation",
        packageCode: "package-123",
        price: "100",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMentorPriceService.getMentorPrice.mockResolvedValue(
        mockPrice,
      );

      const result = await service.getMentorPrice("mentor-123", "consultation");

      expect(mockMentorPriceService.getMentorPrice).toHaveBeenCalledWith(
        "mentor-123",
        "consultation",
      );
      expect(result).toBe(mockPrice);
    });
  });

  describe("adjustPayableLedger", () => {
    const mockOriginalLedger = {
      id: "ledger-123",
      referenceId: "ref-123",
      mentorId: "mentor-123",
      studentId: "student-123",
      sessionTypeCode: "consultation",
      price: "100",
      currency: "USD",
    };

    it("should adjust payable ledger successfully", async () => {
      // [修复] Mock transaction execute to return the ledger (mock事务execute返回ledger)
      mockDb.execute.mockResolvedValue({
        rows: [mockOriginalLedger],
      });
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      await service.adjustPayableLedger({
        originalLedgerId: "ledger-123",
        adjustmentAmount: 50,
        reason: "Adjustment reason",
        createdBy: "user-123",
      });

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.execute).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error when original ledger not found", async () => {
      // [修复] Mock transaction execute to return empty result (mock事务execute返回空结果)
      mockDb.execute.mockResolvedValue({
        rows: [],
      });

      await expect(
        service.adjustPayableLedger({
          originalLedgerId: "non-existent",
          adjustmentAmount: 50,
          reason: "Adjustment reason",
          createdBy: "user-123",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when trying to adjust a settled ledger", async () => {
      // [修复] Test settled ledger check (测试已结算账款检查)
      const settledLedger = {
        ...mockOriginalLedger,
        settlementId: "settlement-123", // Ledger is already settled (账款已结算)
      };

      mockDb.execute.mockResolvedValue({
        rows: [settledLedger],
      });

      await expect(
        service.adjustPayableLedger({
          originalLedgerId: "ledger-123",
          adjustmentAmount: 50,
          reason: "Adjustment reason",
          createdBy: "user-123",
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.adjustPayableLedger({
          originalLedgerId: "ledger-123",
          adjustmentAmount: 50,
          reason: "Adjustment reason",
          createdBy: "user-123",
        }),
      ).rejects.toThrow("Cannot adjust a settled ledger");
    });
  });

  describe("getAdjustmentChain", () => {
    it("should return adjustment chain", async () => {
      const mockChain = [
        { id: "adj-1", originalId: "ledger-123" },
        { id: "adj-2", originalId: "ledger-123" },
      ];
      mockDb.query.mentorPayableLedgers.findMany.mockResolvedValue(mockChain);

      const result = await service.getAdjustmentChain("ledger-123");

      expect(mockDb.query.mentorPayableLedgers.findMany).toHaveBeenCalled();
      expect(result).toBe(mockChain);
    });
  });

  describe("createPlacementBilling", () => {
    const validPayload = {
      applicationId: "app-123",
      studentId: "student-123",
      mentorId: "mentor-123",
      sessionTypeCode: "recommended",
      allowBilling: true,
    };

    const mockMentorPrice = {
      id: "price-123",
      mentorUserId: "mentor-123", // Changed from mentorId to mentorUserId
      sessionTypeCode: "recommended",
      price: "500",
      currency: "USD",
      status: "active",
      updatedBy: null,
      serviceTypeId: null,
      packageCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should create placement billing successfully", async () => {
      mockMentorPriceService.getMentorPrice.mockResolvedValue(mockMentorPrice);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      await service.createPlacementBilling(validPayload);

      expect(mockMentorPriceService.getMentorPrice).toHaveBeenCalledWith(
        "mentor-123",
        "recommended",
      );
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error when applicationId is missing", async () => {
      const invalidPayload = { ...validPayload, applicationId: undefined };
      await expect(
        service.createPlacementBilling(invalidPayload as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should skip billing when allowBilling is false", async () => {
      const payload = { ...validPayload, allowBilling: false };
      await service.createPlacementBilling(payload);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should throw error when mentor price not found", async () => {
      mockMentorPriceService.getMentorPrice.mockResolvedValue(null);
      await expect(
        service.createPlacementBilling(validPayload),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

