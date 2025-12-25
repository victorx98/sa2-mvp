import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { IEmailProvider } from '../../interfaces/email-provider.interface';
import { ISendEmailParams } from '../../interfaces/email.interface';

/**
 * AWS SES Email Provider
 * 
 * Implements email sending via AWS Simple Email Service
 */
@Injectable()
export class AwsSesEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(AwsSesEmailProvider.name);
  private sesClient: SESClient;

  constructor(private readonly configService: ConfigService) {
    this.initializeSesClient();
  }

  /**
   * Initialize AWS SES client
   */
  private initializeSesClient(): void {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('AWS SES credentials not configured. Email service will be disabled.');
      return;
    }

    this.sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`AWS SES Email Provider initialized: region=${region}`);
  }

  /**
   * Send email via AWS SES
   * 
   * @param params - Email parameters
   */
  async send(params: ISendEmailParams): Promise<void> {
    if (!this.sesClient) {
      this.logger.warn('AWS SES client not initialized. Skipping email send.');
      return;
    }

    try {
      const { to, subject, html, cc } = params;

      const fromAddress = this.configService.get<string>('FROM_EMAIL_ADDRESS');

      // Prepare destination
      const destination: any = {
        ToAddresses: [to],
      };

      if (cc) {
        destination.CcAddresses = [cc];
      }

      // Create send email command
      const command = new SendEmailCommand({
        Source: fromAddress,
        Destination: destination,
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const response = await this.sesClient.send(command);

      this.logger.log(`Email sent via AWS SES: ${response.MessageId} to ${to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email via AWS SES to ${params.to}: ${message}`);
      
      if (error && typeof error === 'object') {
        this.logger.error(`Error details: ${JSON.stringify(error)}`);
      }
      
      throw error;
    }
  }
}

