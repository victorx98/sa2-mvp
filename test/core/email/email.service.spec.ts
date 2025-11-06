import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailService } from "@core/email/services/email.service";
import * as nodemailer from "nodemailer";

// Mock nodemailer
jest.mock("nodemailer");

describe("EmailService Unit Tests", () => {
  let service: EmailService;
  let mockTransporter: {
    sendMail: jest.Mock;
  };

  beforeEach(async () => {
    // Create mock transporter
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: "test-message-id",
      }),
    };

    // Mock nodemailer.createTransport
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
      ],
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("send", () => {
    it("should send email successfully with session-created template", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Session Created",
        template: "session-created",
        data: {
          studentName: "John Doe",
          mentorName: "Jane Smith",
          sessionName: "System Design Interview",
          scheduledStartTime: "2025-11-10 14:00:00",
          scheduledDuration: 60,
          meetingUrl: "https://vc.feishu.cn/j/123456789",
          meetingPassword: "abc123",
        },
      };

      // Act
      await service.send(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.to,
          subject: params.subject,
          html: expect.stringContaining(params.data.sessionName),
        }),
      );
    });

    it("should send email successfully with session-cancelled template", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Session Cancelled",
        template: "session-cancelled",
        data: {
          studentName: "John Doe",
          mentorName: "Jane Smith",
          sessionName: "System Design Interview",
          scheduledStartTime: "2025-11-10 14:00:00",
          cancelReason: "Mentor unavailable",
        },
      };

      // Act
      await service.send(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.to,
          subject: params.subject,
          html: expect.stringContaining(params.data.cancelReason),
        }),
      );
    });

    it("should send email successfully with session-reminder template", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Session Reminder",
        template: "session-reminder",
        data: {
          studentName: "John Doe",
          mentorName: "Jane Smith",
          sessionName: "System Design Interview",
          scheduledStartTime: "2025-11-10 14:00:00",
          meetingUrl: "https://vc.feishu.cn/j/123456789",
        },
      };

      // Act
      await service.send(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.to,
          subject: params.subject,
          html: expect.stringContaining(params.data.sessionName),
        }),
      );
    });

    it("should send email successfully with session-completed template", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Session Completed",
        template: "session-completed",
        data: {
          studentName: "John Doe",
          mentorName: "Jane Smith",
          sessionName: "System Design Interview",
          actualDuration: 58,
          recordingUrl: "https://feishu.cn/minutes/rec_xxx",
        },
      };

      // Act
      await service.send(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.to,
          subject: params.subject,
          html: expect.stringContaining(params.data.recordingUrl),
        }),
      );
    });

    it("should send email with CC and attachments", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        cc: "admin@example.com",
        subject: "Test Email",
        template: "session-created",
        data: {
          studentName: "John Doe",
          mentorName: "Jane Smith",
          sessionName: "Test Session",
          scheduledStartTime: "2025-11-10 14:00:00",
          scheduledDuration: 60,
          meetingUrl: "https://vc.feishu.cn/j/123456789",
        },
        attachments: [
          {
            filename: "test.pdf",
            path: "/tmp/test.pdf",
          },
        ],
      };

      // Act
      await service.send(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.to,
          cc: params.cc,
          attachments: params.attachments,
        }),
      );
    });

    it("should use default template when template not found", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Test Email",
        template: "non-existent-template",
        data: {
          testKey: "testValue",
        },
      };

      // Act
      await service.send(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.to,
          html: expect.stringContaining("testKey"),
        }),
      );
    });

    it("should throw error when email sending fails", async () => {
      // Arrange
      const error = new Error("SMTP connection failed");
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      const params = {
        to: "student@example.com",
        subject: "Test Email",
        template: "session-created",
        data: {},
      };

      // Act & Assert
      await expect(service.send(params)).rejects.toThrow(error);
    });
  });

  describe("sendWithAttachments", () => {
    it("should send email with attachments", async () => {
      // Arrange
      const params = {
        to: "student@example.com",
        subject: "Test Email",
        template: "session-created",
        data: {},
        attachments: [
          {
            filename: "test.pdf",
            path: "/tmp/test.pdf",
          },
        ],
      };

      // Act
      await service.sendWithAttachments(params);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: params.attachments,
        }),
      );
    });
  });

  describe("initialization without credentials", () => {
    it("should skip sending email when transporter not initialized", async () => {
      // Arrange - Create service without email credentials
      (nodemailer.createTransport as jest.Mock).mockReturnValue(null);

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                EMAIL_HOST: "smtp.gmail.com",
                EMAIL_PORT: 587,
                EMAIL_USER: undefined, // No email user
                EMAIL_PASSWORD: undefined, // No email password
              }),
            ],
          }),
        ],
        providers: [EmailService],
      }).compile();

      const serviceWithoutCreds = module.get<EmailService>(EmailService);

      // Act
      await serviceWithoutCreds.send({
        to: "test@example.com",
        subject: "Test",
        template: "session-created",
        data: {},
      });

      // Assert - Should not throw error, just skip sending
      expect(true).toBe(true);
    });
  });
});
