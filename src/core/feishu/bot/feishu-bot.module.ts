import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FeishuBotService } from "./services/feishu-bot.service";

/**
 * Feishu Bot Module
 *
 * Provides Feishu bot messaging functionality
 */
@Module({
  imports: [ConfigModule],
  providers: [FeishuBotService],
  exports: [FeishuBotService],
})
export class FeishuBotModule {}
