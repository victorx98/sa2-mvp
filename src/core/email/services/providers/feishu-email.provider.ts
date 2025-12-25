import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { IEmailProvider } from '../../interfaces/email-provider.interface';
import { ISendEmailParams } from '../../interfaces/email.interface';

/**
 * Feishu Email Provider
 * 
 * Implements email sending via Feishu SMTP
 */
@Injectable()
export class FeishuEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(FeishuEmailProvider.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Initialize Feishu SMTP transporter
   */
  private initializeTransporter(): void {
    const host = this.configService.get<string>('FEISHU_SMTP_HOST', 'smtp.feishu.cn');
    const port = this.configService.get<number>('FEISHU_SMTP_PORT', 465);
    const user = this.configService.get<string>('FEISHU_SMTP_USER');
    const pass = this.configService.get<string>('FEISHU_SMTP_PASSWORD');

    if (!user || !pass) {
      this.logger.warn('Feishu SMTP credentials not configured. Email service will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: true, // Port 465 requires secure: true
      auth: {
        user,
        pass,
      },
      greetingTimeout: 10000,
      connectionTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.logger.log(`Feishu Email Provider initialized: ${user}@${host}:${port}`);
  }

  /**
   * Send email via Feishu SMTP
   * 
   * @param params - Email parameters
   */
  async send(params: ISendEmailParams): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Feishu transporter not initialized. Skipping email send.');
      return;
    }

    try {
      const { to, subject, html, cc, attachments } = params;

      const fromAddress = this.configService.get<string>('FROM_EMAIL_ADDRESS', 'noreply@sa2.com');

      const mailOptions: any = {
        from: fromAddress,
        to,
        subject,
        html,
      };

      if (cc) mailOptions.cc = cc;
      if (attachments) mailOptions.attachments = attachments;

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent via Feishu: ${info.messageId} to ${to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email via Feishu to ${params.to}: ${message}`);
      
      if (error && typeof error === 'object') {
        this.logger.error(`Error details: ${JSON.stringify(error)}`);
      }
      
      throw error;
    }
  }
}

