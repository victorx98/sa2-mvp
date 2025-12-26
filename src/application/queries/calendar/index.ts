import { Module } from '@nestjs/common';
import { CalendarQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { GetCalendarEventsUseCase } from './use-cases/get-calendar-events.use-case';

@Module({
  imports: [CalendarQueryRepositoriesModule],
  providers: [GetCalendarEventsUseCase],
  exports: [GetCalendarEventsUseCase],
})
export class CalendarModule {}
