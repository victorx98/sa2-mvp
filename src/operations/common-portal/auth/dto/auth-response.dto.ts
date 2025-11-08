import { ApiProperty } from "@nestjs/swagger";

/**
 * BFF Layer - Auth Response DTO
 * 职责：为前端提供统一的认证响应格式
 * 特点：包含前端需要的字段和提示信息
 */
export class AuthResponseDto {
  @ApiProperty({ description: "JWT access token" })
  accessToken: string;

  @ApiProperty({ description: "Basic user information" })
  user: {
    id: string;
    email: string;
    nickname?: string;
    cnNickname?: string;
    status: string;
  };

  @ApiProperty({ description: "Welcome message (optional)", required: false })
  message?: string;

  @ApiProperty({ description: "Next-step hints (optional)", required: false })
  hints?: string[];
}
