import { ApiProperty } from "@nestjs/swagger";

/**
 * Operations Layer - Session Detail Response DTO
 * 会话详情响应DTO（返回给顾问端前端）
 *
 * 简化版本 - 只返回核心信息
 */
export class SessionDetailResponseDto {
  @ApiProperty({
    description: "预约ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  bookingId: string;

  @ApiProperty({
    description: "会话状态",
    example: "scheduled",
  })
  status: string;

  @ApiProperty({
    description: "会议信息",
    required: false,
  })
  meeting?: {
    url?: string;
    password?: string;
    provider?: string;
  };
}
