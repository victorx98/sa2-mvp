import { ApiProperty } from '@nestjs/swagger';

/**
 * Operations Layer - Session Detail Response DTO
 * 会话详情响应DTO（返回给顾问端前端）
 * 简化版：只返回sessionId和meeting信息
 */
export class SessionDetailResponseDto {
  @ApiProperty({
    description: '会话ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  sessionId: string;

  @ApiProperty({
    description: '会议信息',
    example: {
      url: 'https://zoom.us/j/123456789',
      password: 'abc123',
      provider: 'zoom',
    },
  })
  meeting: {
    url?: string;
    password?: string;
    provider?: string;
  };
}
