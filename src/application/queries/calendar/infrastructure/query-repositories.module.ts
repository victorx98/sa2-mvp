import { Module } from '@nestjs/common';
import { CalendarModule, CalendarService } from '@core/calendar';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { CalendarQueryRepository } from './repositories/calendar-query.repository';
import { CALENDAR_QUERY_REPOSITORY } from '../interfaces/calendar-query.repository.interface';

@Module({
  imports: [DatabaseModule, CalendarModule],
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
