import { Test, TestingModule } from "@nestjs/testing";
import { NotificationService } from "@core/notification/services/notification.service";
import { EmailService } from "@core/email/services/email.service";
import { FeishuBotService } from "@core/feishu/bot/services/feishu-bot.service";
import { ISessionEntity } from "@domains/services/session/interfaces/session.interface";
import { SessionStatus } from "@domains/services/session/interfaces/session.interface";

describe("NotificationService Unit Tests", () => {
  let service: NotificationService;
  let emailService: jest.Mocked<EmailService>;
  let feishuBotService: jest.Mocked<FeishuBotService>;

  beforeEach(async () => {
    // Create mock services
    const mockEmailService = {
      send: jest.fn(),
      sendWithAttachments: jest.fn(),
    };

    const mockFeishuBotService = {
      sendCard: jest.fn(),
      sendTextMessage: jest.fn(),
      sendSessionSummaryCard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: FeishuBotService,
          useValue: mockFeishuBotService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    emailService = module.get(EmailService);
    feishuBotService = module.get(FeishuBotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("sendEmail", () => {
    it("should send email using EmailService", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Test Email",
        template: "test-template",
        data: { key: "value" },
        cc: "admin@example.com",
        attachments: [],
      };

      // Act
      await service.sendEmail(params);

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(1);
      expect(emailService.send).toHaveBeenCalledWith(params);
    });
  });

  describe("sendSessionCreatedEmail", () => {
    it("should send session created email to both student and mentor", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-123",
        studentId: "student-123",
        mentorId: "mentor-123",
        contractId: "contract-123",
        meetingProvider: "feishu",
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: "abc123",
        scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
        scheduledDuration: 60,
        actualStartTime: null,
        actualEndTime: null,
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: "System Design Interview",
        notes: "Discuss distributed systems",
        status: SessionStatus.SCHEDULED,
        createdAt: new Date("2025-11-05T10:00:00Z"),
        updatedAt: new Date("2025-11-05T10:00:00Z"),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";

      // Act
      await service.sendSessionCreatedEmail(session, studentEmail, mentorEmail);

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(2);

      // Check student email
      expect(emailService.send).toHaveBeenNthCalledWith(1, {
        to: studentEmail,
        subject: "约课已创建",
        template: "session-created",
        data: expect.objectContaining({
          sessionName: session.sessionName,
          scheduledDuration: session.scheduledDuration,
          meetingUrl: session.meetingUrl,
          meetingPassword: session.meetingPassword,
        }),
      });

      // Check mentor email
      expect(emailService.send).toHaveBeenNthCalledWith(2, {
        to: mentorEmail,
        subject: "新的约课请求",
        template: "session-created",
        data: expect.objectContaining({
          sessionName: session.sessionName,
        }),
      });
    });
  });

  describe("sendSessionCancelledEmail", () => {
    it("should send session cancelled email to both student and mentor", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-456",
        studentId: "student-456",
        mentorId: "mentor-456",
        contractId: "contract-456",
        meetingProvider: "feishu",
        meetingId: "meeting-456",
        meetingNo: null,
        meetingUrl: "https://vc.feishu.cn/j/456",
        meetingPassword: null,
        scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
        scheduledDuration: 60,
        actualStartTime: null,
        actualEndTime: null,
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: "Mock Interview",
        notes: null,
        status: SessionStatus.CANCELLED,
        createdAt: new Date("2025-11-05T10:00:00Z"),
        updatedAt: new Date("2025-11-08T10:00:00Z"),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";
      const cancelReason = "Mentor unavailable";

      // Act
      await service.sendSessionCancelledEmail(
        session,
        studentEmail,
        mentorEmail,
        cancelReason,
      );

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(2);

      // Check emails contain cancel reason
      expect(emailService.send).toHaveBeenNthCalledWith(1, {
        to: studentEmail,
        subject: "约课已取消",
        template: "session-cancelled",
        data: expect.objectContaining({
          cancelReason,
        }),
      });

      expect(emailService.send).toHaveBeenNthCalledWith(2, {
        to: mentorEmail,
        subject: "约课已取消",
        template: "session-cancelled",
        data: expect.objectContaining({
          cancelReason,
        }),
      });
    });

    it("should use default cancel reason when not provided", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-789",
        studentId: "student-789",
        mentorId: "mentor-789",
        contractId: null,
        meetingProvider: "feishu",
        meetingId: "meeting-789",
        meetingNo: null,
        meetingUrl: "https://vc.feishu.cn/j/789",
        meetingPassword: null,
        scheduledStartTime: new Date(),
        scheduledDuration: 60,
        actualStartTime: null,
        actualEndTime: null,
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: "Test Session",
        notes: null,
        status: SessionStatus.CANCELLED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";

      // Act
      await service.sendSessionCancelledEmail(
        session,
        studentEmail,
        mentorEmail,
      );

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(2);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelReason: "无",
          }),
        }),
      );
    });
  });

  describe("sendSessionReminderEmail", () => {
    it("should send session reminder email to both student and mentor", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-reminder-123",
        studentId: "student-123",
        mentorId: "mentor-123",
        contractId: "contract-123",
        meetingProvider: "feishu",
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
        scheduledDuration: 60,
        actualStartTime: null,
        actualEndTime: null,
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: "Upcoming Session",
        notes: null,
        status: SessionStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";

      // Act
      await service.sendSessionReminderEmail(
        session,
        studentEmail,
        mentorEmail,
      );

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(2);
      expect(emailService.send).toHaveBeenNthCalledWith(1, {
        to: studentEmail,
        subject: "约课提醒 - 即将开始",
        template: "session-reminder",
        data: expect.objectContaining({
          sessionName: session.sessionName,
          meetingUrl: session.meetingUrl,
        }),
      });
    });
  });

  describe("sendSessionCompletedEmail", () => {
    it("should send session completed email with recording", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-completed-123",
        studentId: "student-123",
        mentorId: "mentor-123",
        contractId: "contract-123",
        meetingProvider: "feishu",
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
        scheduledDuration: 60,
        actualStartTime: new Date("2025-11-10T14:02:00Z"),
        actualEndTime: new Date("2025-11-10T15:00:00Z"),
        recordings: [
          {
            recordingId: "rec-123",
            recordingUrl: "https://feishu.cn/minutes/rec-123",
            transcriptUrl: null,
            duration: 3480,
            sequence: 1,
            startedAt: new Date("2025-11-10T14:02:00Z"),
            endedAt: new Date("2025-11-10T15:00:00Z"),
          },
        ],
        aiSummary: null,
        mentorTotalDurationSeconds: 3480,
        studentTotalDurationSeconds: 3480,
        effectiveTutoringDurationSeconds: 3480,
        mentorJoinCount: 1,
        studentJoinCount: 1,
        sessionName: "Completed Session",
        notes: null,
        status: SessionStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";

      // Act
      await service.sendSessionCompletedEmail(
        session,
        studentEmail,
        mentorEmail,
      );

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(2);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actualDuration: 58, // 3480 / 60
            recordingUrl: session.recordings[0].recordingUrl,
          }),
        }),
      );
    });

    it("should send session completed email without recording", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-no-recording",
        studentId: "student-456",
        mentorId: "mentor-456",
        contractId: "contract-456",
        meetingProvider: "feishu",
        meetingId: "meeting-456",
        meetingNo: null,
        meetingUrl: "https://vc.feishu.cn/j/456",
        meetingPassword: null,
        scheduledStartTime: new Date(),
        scheduledDuration: 60,
        actualStartTime: new Date(),
        actualEndTime: new Date(),
        recordings: [], // No recordings
        aiSummary: null,
        mentorTotalDurationSeconds: 3600,
        studentTotalDurationSeconds: 3600,
        effectiveTutoringDurationSeconds: 3600,
        mentorJoinCount: 1,
        studentJoinCount: 1,
        sessionName: "Session Without Recording",
        notes: null,
        status: SessionStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";

      // Act
      await service.sendSessionCompletedEmail(
        session,
        studentEmail,
        mentorEmail,
      );

      // Assert
      expect(emailService.send).toHaveBeenCalledTimes(2);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordingUrl: null,
          }),
        }),
      );
    });

    it("should calculate duration correctly when effectiveTutoringDurationSeconds is null", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-null-duration",
        studentId: "student-789",
        mentorId: "mentor-789",
        contractId: null,
        meetingProvider: "feishu",
        meetingId: "meeting-789",
        meetingNo: null,
        meetingUrl: "https://vc.feishu.cn/j/789",
        meetingPassword: null,
        scheduledStartTime: new Date(),
        scheduledDuration: 60,
        actualStartTime: new Date(),
        actualEndTime: new Date(),
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null, // Null duration
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: "Test Session",
        notes: null,
        status: SessionStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const studentEmail = "student@example.com";
      const mentorEmail = "mentor@example.com";

      // Act
      await service.sendSessionCompletedEmail(
        session,
        studentEmail,
        mentorEmail,
      );

      // Assert
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actualDuration: 0, // Should default to 0
          }),
        }),
      );
    });
  });
});
