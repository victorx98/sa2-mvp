import { ApiProperty } from '@nestjs/swagger';

/**
 * BFF Layer - Auth Response DTO
 * 职责：为前端提供统一的认证响应格式
 * 特点：包含前端需要的字段和提示信息
 */
export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: '用户基本信息' })
  user: {
    id: string;
    email: string;
    nickname?: string;
    cnNickname?: string;
    status: string;
  };

  @ApiProperty({ description: '欢迎提示信息（可选）', required: false })
  message?: string;

  @ApiProperty({ description: '下一步操作提示（可选）', required: false })
  hints?: string[];
}
