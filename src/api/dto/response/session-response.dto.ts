import { ApiProperty } from "@nestjs/swagger";
import { ServiceType } from "@infrastructure/database/schema/service-types.schema";

export class BookSessionResponseDto {
  @ApiProperty({ description: "Created session ID" })
  sessionId: string;

  @ApiProperty({ description: "Student ID" })
  studentId: string;

  @ApiProperty({ description: "Mentor ID" })
  mentorId: string;

  @ApiProperty({
    description: "Type of service fulfilled by this session",
    required: false,
  })
  serviceType?: ServiceType;

  @ApiProperty({ description: "Mentor calendar slot reservation ID" })
  mentorCalendarSlotId: string;

  @ApiProperty({ description: "Student calendar slot reservation ID" })
  studentCalendarSlotId: string;

  @ApiProperty({ description: "Service hold ID consumed by this booking" })
  serviceHoldId: string;

  @ApiProperty({
    description: "Session start time in ISO 8601 format",
    type: String,
    format: "date-time",
  })
  scheduledStartTime: string;

  @ApiProperty({ description: "Session duration in minutes", example: 60 })
  duration: number;

  @ApiProperty({
    description: "Meeting provider platform (e.g., zoom, feishu)",
    required: false,
  })
  meetingProvider?: string;

  @ApiProperty({
    description: "Meeting join password",
    required: false,
  })
  meetingPassword?: string;

  @ApiProperty({
    description: "Meeting join URL",
    required: false,
  })
  meetingUrl?: string;

  @ApiProperty({
    description: "Booking status (e.g., booked, pending_confirmation)",
  })
  status: string;
}
