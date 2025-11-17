import { Test, TestingModule } from "@nestjs/testing";
import { SessionEvaluatedListener } from "./session-evaluated.listener";
import { IMentorPayableService } from "@domains/financial/interfaces/mentor-payable.interface";
import { SessionEvaluatedEvent } from "@domains/financial/events/types/financial-event.types";
import { FinancialModule } from "@domains/financial/financial.module";

// Mock services
const createMockMentorPayableService = (): IMentorPayableService => ({
  createPerSessionBilling: jest.fn(),
  createPackageBilling: jest.fn(),
  adjustPayableLedger: jest.fn(),
  createMentorPrice: jest.fn(),
  queryMentorPayableLedgers: jest.fn(),
});

describe("SessionEvaluatedListener", () => {
  let listener: SessionEvaluatedListener;
  let mentorPayableService: IMentorPayableService;
  let mockMentorPayableService: ReturnType<
    typeof createMockMentorPayableService
  >;

  beforeEach(async () => {
    // Create fresh mock for each test
    mockMentorPayableService = createMockMentorPayableService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionEvaluatedListener,
        {
          provide: "IMentorPayableService",
          useValue: mockMentorPayableService,
        },
      ],
    }).compile();

    listener = module.get<SessionEvaluatedListener>(SessionEvaluatedListener);
    mentorPayableService = module.get<IMentorPayableService>(
      "IMentorPayableService",
    );

    // 清除所有mock的调用历史
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize correctly", () => {
      // 验证监听器正确初始化
      expect(listener).toBeDefined();
    });
  });

  describe("handleSessionEvaluated", () => {
    const mockEvent = new SessionEvaluatedEvent({
      eventId: "event-123",
      eventType: "services.session.evaluated",
      eventTimestamp: new Date(),
      eventVersion: "1.0",
      sessionId: "session-123",
      mentorUserId: "mentor-123",
      studentUserId: "student-123",
      mentorName: "张导师",
      studentName: "李同学",
      serviceTypeCode: "CS_INTERVIEW",
      serviceName: "CS面试辅导",
      durationHours: 1.5,
      rating: 5,
      ratingComment: "非常满意，导师很专业",
      contractId: "contract-123",
      startTime: new Date("2024-01-01T10:00:00Z"),
      endTime: new Date("2024-01-01T11:30:00Z"),
      reviewedAt: new Date("2024-01-01T12:00:00Z"),
    });

    it("should route to per-session billing successfully after evaluation", async () => {
      // 设置mock行为
      (mockMentorPayableService.createPerSessionBilling as jest.Mock).mockResolvedValue({
        id: "ledger-123",
        contractId: "contract-123",
        mentorId: "mentor-123",
        studentId: "student-123",
        serviceType: "CS_INTERVIEW",
        serviceName: "CS面试辅导",
        quantity: 1,
        totalAmount: 150.0,
        currency: "USD",
        status: "pending",
      });
      (
        mockMentorPayableService.createPerSessionBilling as jest.Mock
      ).mockResolvedValue({
        id: "ledger-123",
        sessionId: "session-123",
        totalAmount: 150.0,
      });

      // 执行测试
      await listener.handleSessionEvaluated(mockEvent);

      // 验证结果
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).toHaveBeenCalledWith({
        sessionId: "session-123",
        contractId: "contract-123",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW",
        serviceName: "CS面试辅导",
        durationHours: 1.5,
        startTime: mockEvent.startTime, // 使用事件中的开始时间
        endTime: mockEvent.endTime, // 使用事件中的结束时间
        metadata: expect.objectContaining({
          sessionId: "session-123",
          rating: 5,
          ratingComment: "非常满意，导师很专业",
        }),
      });
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
    });

    it("should route to package billing when package is complete after evaluation", async () => {
      // 准备包计费事件
      const packageEvent = new SessionEvaluatedEvent({
        eventId: "event-124",
        eventType: "services.session.evaluated",
        eventTimestamp: new Date(),
        eventVersion: "1.0",
        sessionId: "session-124",
        mentorUserId: "mentor-124",
        studentUserId: "student-124",
        mentorName: "王导师",
        studentName: "赵同学",
        serviceTypeCode: "CS_COURSE",
        serviceName: "CS课程包",
        durationHours: 2.0,
        rating: 4,
        ratingComment: "课程内容很实用",
        contractId: "contract-124",
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T12:00:00Z"),
        servicePackageId: "package-123",
        packageTotalSessions: 10,
        packageCompletedSessions: 10, // 所有会话已完成
        reviewedAt: new Date("2024-01-01T12:00:00Z"),
      });

      // 设置mock行为
      (
        mockMentorPayableService.createPackageBilling as jest.Mock
      ).mockResolvedValue({
        id: "ledger-124",
        contractId: "contract-124",
        mentorId: "mentor-124",
        studentId: "student-124",
        serviceType: "CS_COURSE",
        serviceName: "CS课程包",
        quantity: 1,
        totalAmount: 2000.0,
        currency: "USD",
        status: "pending",
        servicePackageId: "package-123",
      });

      // 执行测试
      await listener.handleSessionEvaluated(packageEvent);

      // 验证结果 - 应该调用包计费
      expect(
        mockMentorPayableService.createPackageBilling,
      ).toHaveBeenCalledWith({
        contractId: "contract-124",
        servicePackageId: "package-123",
        mentorUserId: "mentor-124",
        studentUserId: "student-124",
        serviceTypeCode: "CS_COURSE",
        serviceName: "CS课程包",
        quantity: 1,
        metadata: expect.objectContaining({
          sessionId: "session-124",
          packageTotalSessions: 10,
          rating: 4,
        }),
      });
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).not.toHaveBeenCalled();
    });

    it("should not create package billing when package is not complete after evaluation", async () => {
      // 准备包计费事件 - 未完成
      const packageEventNotComplete = new SessionEvaluatedEvent({
        eventId: "event-125",
        eventType: "services.session.evaluated",
        eventTimestamp: new Date(),
        eventVersion: "1.0",
        sessionId: "session-125",
        mentorUserId: "mentor-125",
        studentUserId: "student-125",
        mentorName: "王导师",
        studentName: "赵同学",
        serviceTypeCode: "CS_COURSE",
        serviceName: "CS课程包",
        durationHours: 2.0,
        rating: 3,
        ratingComment: "还可以",
        contractId: "contract-125",
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T12:00:00Z"),
        servicePackageId: "package-125",
        packageTotalSessions: 10,
        packageCompletedSessions: 8, // 未完成所有会话
        reviewedAt: new Date("2024-01-01T12:00:00Z"),
      });

      // 执行测试
      await listener.handleSessionEvaluated(packageEventNotComplete);

      // 验证结果 - 不应该调用任何计费方法
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).not.toHaveBeenCalled();
    });

    it("should handle event processing without duplicate check", async () => {

      // 设置mock行为
      (mockMentorPayableService.createPerSessionBilling as jest.Mock).mockResolvedValue({
        id: "ledger-123",
        contractId: "contract-123",
        mentorId: "mentor-123",
        studentId: "student-123",
        serviceType: "CS_INTERVIEW",
        serviceName: "CS面试辅导",
        quantity: 1,
        totalAmount: 150.0,
        currency: "USD",
        status: "pending",
      });

      // 执行测试
      await listener.handleSessionEvaluated(mockEvent);

      // 验证结果 - 应该正常处理事件
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).toHaveBeenCalled();
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
    });

    it("should throw error for invalid event data - missing mentorName", async () => {
      // 准备缺少必要字段的事件
      const invalidEvent = new SessionEvaluatedEvent({
        eventId: "event-invalid",
        eventType: "services.session.evaluated",
        eventTimestamp: new Date(),
        eventVersion: "1.0",
        sessionId: "session-invalid",
        mentorUserId: "mentor-invalid",
        studentUserId: "student-invalid",
        mentorName: undefined as any, // 故意设置为undefined
        studentName: "学生",
        serviceTypeCode: "CS_INTERVIEW",
        serviceName: "CS面试辅导",
        durationHours: 1.5,
        rating: 5,
        ratingComment: "测试",
        reviewedAt: new Date(),
      });

      // 执行测试并验证错误
      await expect(
        listener.handleSessionEvaluated(invalidEvent),
      ).rejects.toThrow();
    });

    it("should handle billing creation failure", async () => {
      // 设置mock行为
      (
        mockMentorPayableService.createPerSessionBilling as jest.Mock
      ).mockRejectedValue(new Error("Billing creation failed"));

      // 执行测试并验证错误
      await expect(listener.handleSessionEvaluated(mockEvent)).rejects.toThrow(
        "Billing creation failed",
      );
    });
  });
});
