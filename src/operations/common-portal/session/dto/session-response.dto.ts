import { ApiProperty } from "@nestjs/swagger";

/**
 * BFF Layer - Session Response DTO
 * 职责：为前端提供会话信息的响应格式
 * 特点：添加前端需要的格式化字段和操作提示
 */
export class SessionResponseDto {
  @ApiProperty({ description: "会话ID" })
  sessionId: string;

  @ApiProperty({ description: "课程名称" })
  name: string;

  @ApiProperty({ description: "导师ID" })
  mentorId: string;

  @ApiProperty({ description: "学生ID" })
  studentId: string;

  @ApiProperty({ description: "开始时间（ISO 8601格式）" })
  startTime: string;

  @ApiProperty({ description: "结束时间（ISO 8601格式）" })
  endTime: string;

  @ApiProperty({ description: "持续时间（分钟）" })
  duration: number;

  @ApiProperty({ description: "会话状态" })
  status: string;

  @ApiProperty({ description: "状态显示文本（前端友好）" })
  statusText: string;

  @ApiProperty({ description: "状态颜色标记（前端使用）" })
  statusColor: string;

  @ApiProperty({ description: "会议链接" })
  meetingUrl: string;

  @ApiProperty({ description: "成功提示信息", required: false })
  message?: string;

  @ApiProperty({ description: "操作提示列表", required: false, type: [String] })
  hints?: string[];

  @ApiProperty({
    description: "可用操作按钮",
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
