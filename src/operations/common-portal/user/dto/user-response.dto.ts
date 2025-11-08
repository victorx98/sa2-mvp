import { ApiProperty } from "@nestjs/swagger";

/**
 * BFF Layer - User Response DTO
 * 职责：为前端提供用户信息的响应格式
 * 特点：添加前端需要的格式化字段和操作提示
 */
export class UserResponseDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "Email" })
  email: string;

  @ApiProperty({ description: "English nickname", required: false })
  nickname?: string;

  @ApiProperty({ description: "Chinese nickname", required: false })
  cnNickname?: string;

  @ApiProperty({ description: "User status" })
  status: string;

  @ApiProperty({ description: "Status display text (frontend friendly)" })
  statusText: string;

  @ApiProperty({ description: "Status color tag (frontend)" })
  statusColor: string;

  @ApiProperty({ description: "Display name (prefers Chinese nickname)" })
  displayName: string;

  @ApiProperty({
    description: "Avatar URL (falls back to default)",
    required: false,
  })
  avatar?: string;

  @ApiProperty({ description: "Available action buttons", required: false })
  actions?: Array<{
    label: string;
    action: string;
    icon?: string;
  }>;
}
