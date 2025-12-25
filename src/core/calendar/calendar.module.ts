import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { CalendarService } from "./services/calendar.service";
import { FeishuCalendarService } from "./services/feishu-calendar.service";
import { GoogleCalendarService } from "./services/google-calendar.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    CalendarService,
    FeishuCalendarService,
    GoogleCalendarService,
  ],
  exports: [
    CalendarService,
    FeishuCalendarService,
    GoogleCalendarService,
  ],
})
export class CalendarModule {}
