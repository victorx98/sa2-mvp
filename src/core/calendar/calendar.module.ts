import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';

/**
 * Core Layer - Calendar Module
 */
@Module({
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
