import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from '../interfaces/email-provider.interface';
import { FeishuEmailProvider } from './providers/feishu-email.provider';
import { AwsSesEmailProvider } from './providers/aws-ses-email.provider';
import { EMAIL_PROVIDER, EmailProvider } from 'src/constants';

/**
 * Email Factory
 * 
 * Factory class to create appropriate email provider based on configuration
 */
@Injectable()
export class EmailFactory {
  private readonly logger = new Logger(EmailFactory.name);

  constructor(
    private readonly feishuProvider: FeishuEmailProvider,
    private readonly awsSesProvider: AwsSesEmailProvider,
  ) {}

  /**
   * Get email provider based on configuration
   * 
   * @returns Email provider instance
   */
  getProvider(): IEmailProvider {
    switch (EMAIL_PROVIDER) {
      case EmailProvider.FEISHU:
        this.logger.log('Using Feishu Email Provider');
        return this.feishuProvider;

      case EmailProvider.AWS_SES:
        this.logger.log('Using AWS SES Email Provider');
        return this.awsSesProvider;

      default:
        this.logger.warn(`Unknown email provider: ${EMAIL_PROVIDER}, falling back to Feishu`);
        return this.feishuProvider;
    }
  }
}

