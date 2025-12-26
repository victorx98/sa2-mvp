import { Module } from '@nestjs/common';
import { CalendarService } from '@core/calendar';
import { CalendarQueryRepository } from './repositories/calendar-query.repository';
import { CALENDAR_QUERY_REPOSITORY } from '../interfaces/calendar-query.repository.interface';

@Module({
  providers: [
    CalendarService,
    {
      provide: CALENDAR_QUERY_REPOSITORY,
      useClass: CalendarQueryRepository,
    },
  ],
  exports: [CALENDAR_QUERY_REPOSITORY, CalendarService],
})
export class CalendarQueryRepositoriesModule {}
