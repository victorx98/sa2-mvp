import { Test, TestingModule } from "@nestjs/testing";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { MentorPayableService } from "./mentor-payable.service";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { mentorPayableLedgers } from "@infrastructure/database/schema";

// Mock数据库连接
const mockDb = {
  query: {
    mentorPrices: {
      findFirst: jest.fn(),
    },
    mentorPayableLedgers: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    domainEvents: {
      findFirst: jest.fn(),
    },
    serviceTypes: {
      findFirst: jest.fn(),
    },
  },
  insert: jest.fn(),
  select: jest.fn(),
} as unknown as DrizzleDatabase;

describe("MentorPayableService", () => {
  let service: MentorPayableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorPayableService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<MentorPayableService>(MentorPayableService);

    // 清除所有mock的调用历史
    jest.clearAllMocks();
  });

  describe("createPerSessionBilling", () => {
    it("should create per-session billing successfully", async () => {
      // 准备测试数据
      const mockDto = {
        sessionId: "session-123",
        contractId: "contract-123",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        serviceName: "CS面试辅导",
        durationHours: 1.5,
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T11:30:00Z"),
      };

      const mockServiceType = {
        id: "service-type-123",
        code: "CS_INTERVIEW",
        name: "CS面试辅导",
        description: "计算机科学面试辅导",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrice = {
        id: "price-123",
        mentorUserId: "mentor-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        price: 100.0,
        currency: "USD",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLedger = {
        id: "ledger-123",
        relationId: "session-123",
        sourceEntity: "session",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        serviceName: "CS面试辅导",
        price: 100.0,
        amount: 150.0,
        currency: "USD",
        createdAt: new Date(),
        createdBy: "system",
      };

      // 设置mock行为
      (mockDb.query.serviceTypes.findFirst as jest.Mock).mockResolvedValue(
        mockServiceType,
      );
      (mockDb.query.mentorPrices.findFirst as jest.Mock).mockResolvedValue(
        mockPrice,
      );
      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // 执行测试
      const result = await service.createPerSessionBilling(mockDto);

      // 验证结果
      expect(result).toBeDefined();
      expect(result.id).toBe("ledger-123");
      expect(result.sessionId).toBe("session-123");
      expect(result.totalAmount).toBe(150.0);
      expect(mockDb.query.serviceTypes.findFirst).toHaveBeenCalled();
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledWith(mentorPayableLedgers);
    });

    it("should throw error when mentor price not found", async () => {
      // 准备测试数据
      const mockDto = {
        sessionId: "session-123",
        contractId: "contract-123",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        durationHours: 1.5,
        startTime: new Date(),
        endTime: new Date(),
      };

      const mockServiceType = {
        id: "service-type-123",
        code: "CS_INTERVIEW",
        name: "CS面试辅导",
        description: "计算机科学面试辅导",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 设置mock行为
      (mockDb.query.serviceTypes.findFirst as jest.Mock).mockResolvedValue(
        mockServiceType,
      );
      (mockDb.query.mentorPrices.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      // 执行测试并验证错误
      await expect(service.createPerSessionBilling(mockDto)).rejects.toThrow(
        "No active price found for mentor: mentor-123 and service type: CS_INTERVIEW",
      );
      expect(mockDb.query.serviceTypes.findFirst).toHaveBeenCalled();
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });
  });

  describe("createPackageBilling", () => {
    it("should create package billing successfully", async () => {
      // 准备测试数据
      const mockDto = {
        contractId: "contract-123",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_COURSE", // 使用serviceTypeCode引用service_types.code
        serviceName: "CS课程包",
        quantity: 10,
        servicePackageId: "package-123",
      };

      const mockServiceType = {
        id: "service-type-123",
        code: "CS_COURSE",
        name: "CS课程",
        description: "计算机科学课程",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrice = {
        id: "price-123",
        mentorUserId: "mentor-123",
        serviceTypeCode: "CS_COURSE", // 使用serviceTypeCode引用service_types.code
        price: 200.0,
        currency: "USD",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLedger = {
        id: "ledger-123",
        relationId: "contract-123",
        sourceEntity: "contract",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_COURSE", // 使用serviceTypeCode引用service_types.code
        serviceName: "CS课程包",
        price: 200.0,
        amount: 2000.0,
        currency: "USD",
        servicePackageId: "package-123",
        createdAt: new Date(),
        createdBy: "system",
      };

      // 设置mock行为
      (mockDb.query.serviceTypes.findFirst as jest.Mock).mockResolvedValue(
        mockServiceType,
      );
      (mockDb.query.mentorPrices.findFirst as jest.Mock).mockResolvedValue(
        mockPrice,
      );
      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockLedger]),
        }),
      });

      // 执行测试
      const result = await service.createPackageBilling(mockDto);

      // 验证结果
      expect(result).toBeDefined();
      expect(result.id).toBe("ledger-123");
      expect(result.totalAmount).toBe(2000.0);
      expect(result.quantity).toBe(10);
      expect(result.status).toBe("pending");
      expect(mockDb.query.serviceTypes.findFirst).toHaveBeenCalled();
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });
  });

  describe("adjustPayableLedger", () => {
    it("should adjust payable ledger successfully - discount scenario", async () => {
      // 准备测试数据 - 退款场景（负值）
      const mockDto = {
        ledgerId: "ledger-123",
        adjustmentAmount: -20.0, // 退款20美元
        reason: "时长记录错误",
        createdBy: "admin-123",
      };

      const mockOriginalLedger = {
        id: "ledger-123",
        relationId: "session-123",
        sourceEntity: "session",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        serviceName: "CS面试辅导",
        price: 100.0,
        amount: 100.0,
        currency: "USD",
        createdAt: new Date(),
        createdBy: "system",
      };

      const mockAdjustmentLedger = {
        id: "adjustment-123",
        originalId: "ledger-123",
        relationId: "session-123",
        sourceEntity: "session",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        serviceName: "CS面试辅导",
        price: 100.0,
        amount: -20.0, // 调整值为-20（实际退款金额）
        currency: "USD",
        adjustmentReason: "时长记录错误",
        createdAt: new Date(),
        createdBy: "admin-123",
      };

      // 设置mock行为
      (
        mockDb.query.mentorPayableLedgers.findFirst as jest.Mock
      ).mockResolvedValue(mockOriginalLedger);
      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockAdjustmentLedger]),
        }),
      });

      // 执行测试
      const result = await service.adjustPayableLedger(mockDto);

      // 验证结果
      expect(result).toBeDefined();
      expect(result.id).toBe("adjustment-123");
      expect(result.totalAmount).toBe(-20.0); // 调整金额为-20
      expect(result.status).toBe("adjusted");
      expect(result.adjustmentReason).toBe("时长记录错误");
    });

    it("should adjust payable ledger successfully - additional charge scenario", async () => {
      // 准备测试数据 - 补扣场景（正值）
      const mockDto = {
        ledgerId: "ledger-456",
        adjustmentAmount: 50.0, // 补扣50美元
        reason: "补充费用：增加了额外服务内容",
        createdBy: "admin-456",
      };

      const mockOriginalLedger = {
        id: "ledger-456",
        relationId: "session-456",
        sourceEntity: "session",
        mentorUserId: "mentor-456",
        studentUserId: "student-456",
        serviceTypeCode: "CAREER_CONSULTATION", // 使用serviceTypeCode引用service_types.code
        serviceName: "职业规划咨询",
        price: 200.0,
        amount: 200.0,
        currency: "USD",
        createdAt: new Date(),
        createdBy: "system",
      };

      const mockAdjustmentLedger = {
        id: "adjustment-456",
        originalId: "ledger-456",
        relationId: "session-456",
        sourceEntity: "session",
        mentorUserId: "mentor-456",
        studentUserId: "student-456",
        serviceTypeCode: "CAREER_CONSULTATION", // 使用serviceTypeCode引用service_types.code
        serviceName: "职业规划咨询",
        price: 200.0,
        amount: 50.0, // 调整值为50（实际补扣金额）
        currency: "USD",
        adjustmentReason: "补充费用：增加了额外服务内容",
        createdAt: new Date(),
        createdBy: "admin-456",
      };

      // 设置mock行为
      (
        mockDb.query.mentorPayableLedgers.findFirst as jest.Mock
      ).mockResolvedValue(mockOriginalLedger);
      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockAdjustmentLedger]),
        }),
      });

      // 执行测试
      const result = await service.adjustPayableLedger(mockDto);

      // 验证结果
      expect(result).toBeDefined();
      expect(result.id).toBe("adjustment-456");
      expect(result.totalAmount).toBe(50.0); // 调整金额为50
      expect(result.status).toBe("adjusted");
      expect(result.adjustmentReason).toBe("补充费用：增加了额外服务内容");
    });

    it("should throw error when original ledger not found", async () => {
      // 准备测试数据
      const mockDto = {
        ledgerId: "non-existent-ledger",
        adjustmentAmount: 0.9,
        reason: "调整原因",
        createdBy: "admin-123",
      };

      // 设置mock行为
      (
        mockDb.query.mentorPayableLedgers.findFirst as jest.Mock
      ).mockResolvedValue(null);

      // 执行测试并验证错误
      await expect(service.adjustPayableLedger(mockDto)).rejects.toThrow(
        "Ledger not found: non-existent-ledger",
      );
    });
  });

  describe("getMentorPrice", () => {
    it("should return mentor price successfully", async () => {
      // 准备测试数据
      const mockServiceType = {
        id: "service-type-123",
        code: "CS_INTERVIEW",
        name: "CS面试辅导",
        description: "计算机科学面试辅导",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrice = {
        id: "price-123",
        mentorUserId: "mentor-123",
        serviceTypeCode: "CS_INTERVIEW", // 使用serviceTypeCode引用service_types.code
        price: 100.0,
        currency: "USD",
        status: "active",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      // 设置mock行为
      (mockDb.query.serviceTypes.findFirst as jest.Mock).mockResolvedValue(
        mockServiceType,
      );
      (mockDb.query.mentorPrices.findFirst as jest.Mock).mockResolvedValue(
        mockPrice,
      );

      // 执行测试
      const result = await service.getMentorPrice("mentor-123", "CS_INTERVIEW");

      // 验证结果
      expect(result).toBeDefined();
      expect(result?.id).toBe("price-123");
      expect(result?.price).toBe(100.0);
      expect(result?.status).toBe("active");
      expect(mockDb.query.serviceTypes.findFirst).toHaveBeenCalled();
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });

    it("should return null when mentor price not found", async () => {
      // 准备测试数据
      const mockServiceType = {
        id: "service-type-123",
        code: "CS_INTERVIEW",
        name: "CS面试辅导",
        description: "计算机科学面试辅导",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 设置mock行为
      (mockDb.query.serviceTypes.findFirst as jest.Mock).mockResolvedValue(
        mockServiceType,
      );
      (mockDb.query.mentorPrices.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      // 执行测试
      const result = await service.getMentorPrice("mentor-123", "CS_INTERVIEW");

      // 验证结果
      expect(result).toBeNull();
      expect(mockDb.query.serviceTypes.findFirst).toHaveBeenCalled();
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });

    it("should return null when service type not found", async () => {
      // 设置mock行为
      (mockDb.query.serviceTypes.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      // 执行测试
      const result = await service.getMentorPrice(
        "mentor-123",
        "UNKNOWN_SERVICE",
      );

      // 验证结果
      expect(result).toBeNull();
      expect(mockDb.query.serviceTypes.findFirst).toHaveBeenCalled();
      expect(mockDb.query.mentorPrices.findFirst).not.toHaveBeenCalled();
    });
  });
});
