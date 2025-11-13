import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "@core/email/services/email.service";
import { FeishuBotService } from "@core/feishu/bot/services/feishu-bot.service";
import { SendEmailDto } from "../dto/send-email.dto";
import { ISessionEntity } from "@domains/services/session/interfaces/session.interface";

/**
 * Notification Service
 *
 * Provides email sending and Feishu bot messaging
 * Business-level notification methods for session events
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly feishuBotService: FeishuBotService,
  ) {}

  /**
   * Send email (generic)
   *
   * @param params - Email parameters
   */
  async sendEmail(params: SendEmailDto): Promise<void> {
    this.logger.debug(`Sending email to: ${params.to}`);

    await this.emailService.send({
      to: params.to,
      subject: params.subject,
      template: params.template,
      data: params.data,
      cc: params.cc,
      attachments: params.attachments,
    });
  }

  /**
   * Send session created email
   *
   * @param session - Session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   */
  async sendSessionCreatedEmail(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending session created email for session: ${session.id}`,
    );

    const data = {
      sessionName: session.sessionName,
      scheduledStartTime: session.scheduledStartTime.toLocaleString("zh-CN"),
      scheduledDuration: session.scheduledDuration,
      meetingUrl: session.meetingUrl || "",
      meetingPassword: session.meetingPassword || "",
      studentName: "学生", // TODO: Get from user service
      mentorName: "导师", // TODO: Get from user service
    };

    // Send to student
    await this.emailService.send({
      to: studentEmail,
      subject: "约课已创建",
      template: "session-created",
      data,
    });

    // Send to mentor
    await this.emailService.send({
      to: mentorEmail,
      subject: "新的约课请求",
      template: "session-created",
      data,
    });

    this.logger.log(`Session created emails sent for session: ${session.id}`);
  }

  /**
   * Send session cancelled email
   *
   * @param session - Session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   * @param cancelReason - Cancellation reason
   */
  async sendSessionCancelledEmail(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
    cancelReason?: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending session cancelled email for session: ${session.id}`,
    );

    const data = {
      sessionName: session.sessionName,
      scheduledStartTime: session.scheduledStartTime.toLocaleString("zh-CN"),
      cancelReason: cancelReason || "无",
      studentName: "学生", // TODO: Get from user service
      mentorName: "导师", // TODO: Get from user service
    };

    // Send to student
    await this.emailService.send({
      to: studentEmail,
      subject: "约课已取消",
      template: "session-cancelled",
      data,
    });

    // Send to mentor
    await this.emailService.send({
      to: mentorEmail,
      subject: "约课已取消",
      template: "session-cancelled",
      data,
    });

    this.logger.log(`Session cancelled emails sent for session: ${session.id}`);
  }

  /**
   * Send session reminder email
   *
   * @param session - Session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   */
  async sendSessionReminderEmail(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending session reminder email for session: ${session.id}`,
    );

    const data = {
      sessionName: session.sessionName,
      scheduledStartTime: session.scheduledStartTime.toLocaleString("zh-CN"),
      meetingUrl: session.meetingUrl || "",
      studentName: "学生", // TODO: Get from user service
      mentorName: "导师", // TODO: Get from user service
    };

    // Send to student
    await this.emailService.send({
      to: studentEmail,
      subject: "约课提醒 - 即将开始",
      template: "session-reminder",
      data,
    });

    // Send to mentor
    await this.emailService.send({
      to: mentorEmail,
      subject: "约课提醒 - 即将开始",
      template: "session-reminder",
      data,
    });

    this.logger.log(`Session reminder emails sent for session: ${session.id}`);
  }

  /**
   * Send session completed email
   *
   * @param session - Session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   */
  async sendSessionCompletedEmail(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending session completed email for session: ${session.id}`,
    );

    const actualDuration = session.actualServiceDuration || 0;

    const recordingUrl =
      session.recordings.length > 0 ? session.recordings[0].recordingUrl : null;

    const data = {
      sessionName: session.sessionName,
      actualDuration,
      recordingUrl,
      studentName: "学生", // TODO: Get from user service
      mentorName: "导师", // TODO: Get from user service
    };

    // Send to student
    await this.emailService.send({
      to: studentEmail,
      subject: "约课已完成",
      template: "session-completed",
      data,
    });

    // Send to mentor
    await this.emailService.send({
      to: mentorEmail,
      subject: "约课已完成",
      template: "session-completed",
      data,
    });

    this.logger.log(`Session completed emails sent for session: ${session.id}`);
  }
}
