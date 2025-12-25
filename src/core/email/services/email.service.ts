import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ISendEmailParams } from "../interfaces/email.interface";
import { IEmailProvider } from "../interfaces/email-provider.interface";
import { EmailFactory } from "./email.factory";

/**
 * Email Service
 *
 * Facade service that delegates email sending to configured provider
 * Supports templates and attachments
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: IEmailProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailFactory: EmailFactory,
  ) {
    this.provider = this.emailFactory.getProvider();
  }

  /**
   * Send email via configured provider
   *
   * @param params - Email parameters
   */
  async send(params: ISendEmailParams): Promise<void> {
    try {
      const { template, data, html: providedHtml } = params;

      // Use provided HTML or render from template
      const html = providedHtml || (template ? this.renderTemplate(template, data!) : '');

      // Delegate to provider
      await this.provider.send({
        ...params,
        html,
      });
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
