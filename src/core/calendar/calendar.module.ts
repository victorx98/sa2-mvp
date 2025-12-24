import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { CalendarService } from "./services/calendar.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    CalendarService,
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
