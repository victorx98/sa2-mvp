import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EmailService } from "./services/email.service";
import { EmailFactory } from "./services/email.factory";
import { FeishuEmailProvider } from "./services/providers/feishu-email.provider";
import { AwsSesEmailProvider } from "./services/providers/aws-ses-email.provider";

/**
 * Email Module
 *
 * Provides email sending functionality with multiple provider support
 * Uses factory pattern to select provider based on configuration
 */
@Module({
  imports: [ConfigModule],
  providers: [
    FeishuEmailProvider,
    AwsSesEmailProvider,
    EmailFactory,
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
