import { Module } from '@nestjs/common';
import { MeetingProviderService } from './meeting-provider.service';

/**
 * Core Layer - Meeting Provider Module
 */
@Module({
  providers: [MeetingProviderService],
  exports: [MeetingProviderService],
})
export class MeetingProviderModule {}
