import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as sgMail from "@sendgrid/mail";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ISendEmailParams } from "../interfaces/email.interface";

/**
 * Email Service
 *
 * Provides email sending functionality using SendGrid API
 * Supports templates and attachments
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiKey: string;
  private fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  /**
   * Initialize SendGrid client
   */
  private initializeClient(): void {
    this.apiKey = this.configService.get<string>("SENDGRID_API_KEY");
    this.fromAddress = this.configService.get<string>(
      "FROM_EMAIL_ADDRESS",
      "noreply@sa2.com",
    );

    if (!this.apiKey) {
      this.logger.warn(
        "SendGrid API key not configured. Email service will be disabled.",
      );
      return;
    }

    // Configure SendGrid client
    sgMail.setApiKey(this.apiKey);
    
    // Disable proxy for SendGrid to avoid HTTP/HTTPS port mismatch
    // SendGrid client uses axios internally, set proxy to false
    const client = (sgMail as any).client;
    if (client && client.setDefaultRequest) {
      client.setDefaultRequest('proxy', false);
      this.logger.log(`SendGrid client initialized with from: ${this.fromAddress} (proxy disabled)`);
    } else {
      this.logger.log(`SendGrid client initialized with from: ${this.fromAddress}`);
    }
  }

  /**
   * Send email
   *
   * @param params - Email parameters
   */
  async send(params: ISendEmailParams): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        "SendGrid API key not configured. Skipping email send.",
      );
      return;
    }

    try {
      const { to, subject, template, data, html: providedHtml, cc, attachments } = params;

      // Use provided HTML or render from template
      const html = providedHtml || this.renderTemplate(template!, data!);

      // Prepare email message (remove undefined fields for SendGrid)
      const msg: any = {
        to,
        from: this.fromAddress,
        subject,
        html,
      };

      // Add optional fields only if they exist
      if (cc) msg.cc = cc;
      if (attachments) msg.attachments = this.formatAttachments(attachments);

      // Send email via SendGrid
      const response = await sgMail.send(msg);
      this.logger.log(`Email sent successfully to ${to}: ${response[0].statusCode}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Log detailed error for debugging
      this.logger.error(`Failed to send email to ${params.to}: ${message}`);
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as any;
        this.logger.error(`SendGrid error details: ${JSON.stringify(sgError.response?.body)}`);
      }
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
   * Format attachments for SendGrid API
   */
  private formatAttachments(
    attachments: any[],
  ): { content: string; filename: string; type: string; disposition: string }[] {
    return attachments.map((att) => ({
      content: att.content,
      filename: att.filename,
      type: att.contentType || "application/octet-stream",
      disposition: "attachment",
    }));
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
