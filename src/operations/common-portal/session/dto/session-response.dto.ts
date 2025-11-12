import { ApiProperty } from "@nestjs/swagger";

/**
 * BFF Layer - Session Response DTO
 * 职责：为前端提供会话信息的响应格式
 * 特点：添加前端需要的格式化字段和操作提示
 */
export class SessionResponseDto {
  @ApiProperty({ description: "Session ID" })
  sessionId: string;

  @ApiProperty({ description: "Session name" })
  name: string;

  @ApiProperty({ description: "Mentor ID" })
  mentorId: string;

  @ApiProperty({ description: "Student ID" })
  studentId: string;

  @ApiProperty({ description: "Start time (ISO 8601 format)" })
  startTime: string;

  @ApiProperty({ description: "End time (ISO 8601 format)" })
  endTime: string;

  @ApiProperty({ description: "Duration (minutes)" })
  duration: number;

  @ApiProperty({ description: "Session status" })
  status: string;

  @ApiProperty({ description: "Status display text (frontend friendly)" })
  statusText: string;

  @ApiProperty({ description: "Status color tag (frontend)" })
  statusColor: string;

  @ApiProperty({ description: "Meeting URL" })
  meetingUrl: string;

  @ApiProperty({ description: "Success message", required: false })
  message?: string;

  @ApiProperty({
    description: "Action hints list",
    required: false,
    type: [String],
  })
  hints?: string[];

  @ApiProperty({
    description: "Available action buttons",
    required: false,
    type: "array",
    items: {
      type: "object",
      properties: {
        label: { type: "string" },
        action: { type: "string" },
        icon: { type: "string" },
        url: { type: "string" },
      },
    },
  })
  actions?: Array<{
    label: string;
    action: string;
    icon?: string;
    url?: string;
  }>;
}
