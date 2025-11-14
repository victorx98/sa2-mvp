import { Test, TestingModule } from "@nestjs/testing";
import { SessionCompletedListener } from "./session-completed.listener";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SessionCompletedEvent } from "@domains/financial/events/types/financial-event.types";

// Mock services
const mockMentorPayableService = {
  createPerSessionBilling: jest.fn(),
  createPackageBilling: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
};

describe("SessionCompletedListener", () => {
  let listener: SessionCompletedListener;
  let mentorPayableService: MentorPayableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCompletedListener,
        {
          provide: MentorPayableService,
          useValue: mockMentorPayableService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    listener = module.get<SessionCompletedListener>(SessionCompletedListener);
    mentorPayableService =
      module.get<MentorPayableService>(MentorPayableService);

    // 清除所有mock的调用历史
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize listener correctly", () => {
      // 验证监听器正确初始化
      expect(listener).toBeDefined();
    });
  });

  describe("handleSessionCompleted", () => {
    const mockEvent = new SessionCompletedEvent({
      eventId: "event-123",
      eventType: "services.session.completed",
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
      completedAt: new Date("2024-01-01T11:30:00Z"),
      requiredEvaluation: false,
    });

    it("should route to per-session billing successfully", async () => {
      // 设置mock行为
      (
        mockMentorPayableService.createPerSessionBilling as jest.Mock
      ).mockResolvedValue({
        id: "ledger-123",
        sessionId: "session-123",
        totalAmount: 150.0,
      });

      // 执行测试
      await listener.handleSessionCompleted(mockEvent);

      // 验证结果
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).toHaveBeenCalledWith({
        contractId: "session-123-contract",
        sessionId: "session-123",
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        serviceTypeCode: "CS_INTERVIEW",
        serviceName: "CS面试辅导",
        durationHours: 1.5,
        startTime: mockEvent.completedAt,
        endTime: mockEvent.completedAt,
        metadata: expect.objectContaining({
          eventType: "services.session.completed",
          mentorName: "张导师",
          studentName: "李同学",
          completedAt: mockEvent.completedAt,
        }),
      });
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
    });

    it("should route to package billing when package is complete", async () => {
      // 准备包计费事件
      const packageEvent = new SessionCompletedEvent({
        eventId: "event-124",
        eventType: "services.session.completed",
        eventTimestamp: new Date(),
        eventVersion: "1.0",
        sessionId: "session-124",
        mentorUserId: "mentor-124",
        studentUserId: "student-124",
        mentorName: "王导师",
        studentName: "赵同学",
        serviceTypeCode: "CS_COURSE",
        serviceName: "CS课程包",
        durationHours: 2,
        completedAt: new Date("2024-01-01T12:00:00Z"),
        requiredEvaluation: false,
        servicePackageId: "package-123",
        packageTotalSessions: 10,
        packageCompletedSessions: 10, // 所有会话已完成
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
      await listener.handleSessionCompleted(packageEvent);

      // 验证结果 - 应该调用包计费
      expect(
        mockMentorPayableService.createPackageBilling,
      ).toHaveBeenCalledWith({
        contractId: "package-123-contract",
        servicePackageId: "package-123",
        mentorUserId: "mentor-124",
        studentUserId: "student-124",
        serviceTypeCode: "CS_COURSE",
        serviceName: "CS课程包",
        quantity: 1,
        metadata: expect.objectContaining({
          eventType: "services.session.completed",
          mentorName: "王导师",
          studentName: "赵同学",
          completedAt: packageEvent.completedAt,
          packageTotalSessions: 10,
          packageCompletedSessions: 10,
        }),
      });
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).not.toHaveBeenCalled();
    });

    it("should not create package billing when package is not complete", async () => {
      // 准备包计费事件 - 未完成
      const packageEventNotComplete = new SessionCompletedEvent({
        eventId: "event-125",
        eventType: "services.session.completed",
        eventTimestamp: new Date(),
        eventVersion: "1.0",
        sessionId: "session-125",
        mentorUserId: "mentor-125",
        studentUserId: "student-125",
        mentorName: "王导师",
        studentName: "赵同学",
        serviceTypeCode: "CS_COURSE",
        serviceName: "CS课程包",
        durationHours: 2,
        completedAt: new Date("2024-01-01T12:00:00Z"),
        requiredEvaluation: false,
        servicePackageId: "package-123",
        packageTotalSessions: 10,
        packageCompletedSessions: 8, // 未完成所有会话
      });

      // 执行测试
      await listener.handleSessionCompleted(packageEventNotComplete);

      // 验证结果 - 不应该调用任何计费方法
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).not.toHaveBeenCalled();
    });

    it("should wait for evaluation when required", async () => {
      const evaluationEvent = new SessionCompletedEvent({
        eventId: "event-123",
        eventType: "services.session.completed",
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
        completedAt: new Date("2024-01-01T11:30:00Z"),
        requiredEvaluation: true,
      });


      // 执行测试
      await listener.handleSessionCompleted(evaluationEvent);

      // 验证结果 - 不应该调用计费方法
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).not.toHaveBeenCalled();
    });

    it("should handle event processing without duplicate check", async () => {
      // 执行测试
      await listener.handleSessionCompleted(mockEvent);

      // 验证结果 - 应该正常处理事件
      expect(
        mockMentorPayableService.createPerSessionBilling,
      ).toHaveBeenCalled();
      expect(
        mockMentorPayableService.createPackageBilling,
      ).not.toHaveBeenCalled();
    });

    it("should throw error for invalid event data - missing sessionId", async () => {
      // 准备缺少必要字段的事件
      const invalidEvent = new SessionCompletedEvent({
        eventId: "event-123",
        eventType: "services.session.completed",
        eventTimestamp: new Date(),
        eventVersion: "1.0",
        sessionId: undefined as any, // 显式设为undefined以测试验证逻辑
        mentorUserId: "mentor-123",
        studentUserId: "student-123",
        mentorName: "张导师",
        studentName: "李同学",
        serviceTypeCode: "CS_INTERVIEW",
        serviceName: "CS面试辅导",
        durationHours: 1.5,
        completedAt: new Date("2024-01-01T11:30:00Z"),
        requiredEvaluation: false,
      });

      // 执行测试并验证错误
      await expect(
        listener.handleSessionCompleted(invalidEvent),
      ).rejects.toThrow();
    });
  });
});
