import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { ISendEmailParams } from "../interfaces/email.interface";

/**
 * Email Service
 *
 * Provides email sending functionality using nodemailer
 * Supports templates and attachments
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    const host = this.configService.get<string>("EMAIL_HOST", "smtp.gmail.com");
    const port = this.configService.get<number>("EMAIL_PORT", 587);
    const user = this.configService.get<string>("EMAIL_USER");
    const pass = this.configService.get<string>("EMAIL_PASSWORD");

    if (!user || !pass) {
      this.logger.warn(
        "Email credentials not configured. Email service will be disabled.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // Use TLS for port 465
      auth: {
        user,
        pass,
      },
    });

    this.logger.log(`Email service initialized: ${user}@${host}:${port}`);
  }

  /**
   * Send email
   *
   * @param params - Email parameters
   */
  async send(params: ISendEmailParams): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        "Email transporter not initialized. Skipping email send.",
      );
      return;
    }

    try {
      const { to, subject, template, data, cc, attachments } = params;

      // Render email content from template
      const html = this.renderTemplate(template, data);

      // Send email
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>(
          "FROM_EMAIL_ADDRESS",
          this.configService.get<string>("EMAIL_FROM", '"SA2 Platform" <noreply@sa2.com>'),
        ),
        to,
        cc,
        subject,
        html,
        attachments,
      });

      this.logger.log(`Email sent successfully: ${info.messageId} to ${to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${params.to}: ${message}`);
      throw error;
    }
  }

  /**
   * Send email with attachments
   *
   * @param params - Email parameters with attachments
   */
  async sendWithAttachments(params: ISendEmailParams): Promise<void> {
    return this.send(params);
  }

  /**
   * Render email template
   *
   * @param template - Template name
   * @param data - Template data
   * @returns Rendered HTML
   */
  private renderTemplate(
    template: string,
    data: Record<string, unknown>,
  ): string {
    // TODO: Integrate with a template engine (Handlebars, EJS, etc.)
    // For now, use simple template strings

    const templates: Record<string, (data: Record<string, unknown>) => string> =
      {
        "session-created": (d) => `
        <html>
          <body>
            <h2>约课已创建</h2>
            <p>您好，${d.studentName}，</p>
            <p>您与导师 ${d.mentorName} 的约课已成功创建：</p>
            <ul>
              <li><strong>约课名称</strong>: ${d.sessionName}</li>
              <li><strong>开始时间</strong>: ${d.scheduledStartTime}</li>
              <li><strong>时长</strong>: ${d.scheduledDuration} 分钟</li>
              <li><strong>会议链接</strong>: <a href="${d.meetingUrl}">${d.meetingUrl}</a></li>
              ${d.meetingPassword ? `<li><strong>会议密码</strong>: ${d.meetingPassword}</li>` : ""}
            </ul>
            <p>期待您的参与！</p>
          </body>
        </html>
      `,

        "session-cancelled": (d) => `
        <html>
          <body>
            <h2>约课已取消</h2>
            <p>您好，${d.studentName}，</p>
            <p>您与导师 ${d.mentorName} 的约课已被取消：</p>
            <ul>
              <li><strong>约课名称</strong>: ${d.sessionName}</li>
              <li><strong>原定时间</strong>: ${d.scheduledStartTime}</li>
            </ul>
            ${d.cancelReason ? `<p><strong>取消原因</strong>: ${d.cancelReason}</p>` : ""}
            <p>如有疑问，请联系客服。</p>
          </body>
        </html>
      `,

        "session-reminder": (d) => `
        <html>
          <body>
            <h2>约课提醒</h2>
            <p>您好，${d.studentName}，</p>
            <p>您与导师 ${d.mentorName} 的约课即将开始：</p>
            <ul>
              <li><strong>约课名称</strong>: ${d.sessionName}</li>
              <li><strong>开始时间</strong>: ${d.scheduledStartTime}</li>
              <li><strong>会议链接</strong>: <a href="${d.meetingUrl}">${d.meetingUrl}</a></li>
            </ul>
            <p>请准时参加！</p>
          </body>
        </html>
      `,

        "session-completed": (d) => `
        <html>
          <body>
            <h2>约课已完成</h2>
            <p>您好，${d.studentName}，</p>
            <p>您与导师 ${d.mentorName} 的约课已完成：</p>
            <ul>
              <li><strong>约课名称</strong>: ${d.sessionName}</li>
              <li><strong>实际时长</strong>: ${d.actualDuration} 分钟</li>
            </ul>
            ${d.recordingUrl ? `<p><strong>录制链接</strong>: <a href="${d.recordingUrl}">点击查看</a></p>` : ""}
            <p>感谢您的参与！</p>
          </body>
        </html>
      `,
      };

    const templateFn = templates[template];
    if (!templateFn) {
      this.logger.warn(
        `Template not found: ${template}, using default template`,
      );
      return `<html><body><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
    }

    return templateFn(data);
  }
}

