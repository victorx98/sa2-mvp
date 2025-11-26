import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { CalendarService } from "./services/calendar.service";
import { MeetingCompletedListener } from "./listeners/meeting-completed.listener";

@Module({
  imports: [DatabaseModule],
  providers: [
    CalendarService,
    MeetingCompletedListener, // v4.1 - Listen to meeting.lifecycle.completed
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
