import { ApiProperty } from "@nestjs/swagger";
import { UserProfile, AuthResult } from "@shared/types/auth.types";

/**
 * 用户档案响应 DTO
 * 实现 UserProfile 接口，确保字段一致性，并添加 Swagger 文档装饰器
 */
export class AuthUserResponseDto implements UserProfile {
  @ApiProperty({ description: "Supabase user ID" })
  id: string;

  @ApiProperty({ description: "User email address" })
  email: string;

  @ApiProperty({ description: "English name", required: false })
  nameEn?: string;

  @ApiProperty({ description: "Chinese name", required: false })
  nameZh?: string;

  @ApiProperty({
    description: "Account status (e.g., active, suspended)",
    required: false,
  })
  status?: string;

  @ApiProperty({
    description: "Roles granted to the user",
    type: [String],
    example: ["student"],
  })
  roles: string[];
}

/**
 * 认证响应 DTO
 * 实现 AuthResult 接口，确保字段一致性，并添加 Swagger 文档装饰器
 */
export class AuthResponseDto implements AuthResult {
  @ApiProperty({ description: "JWT access token" })
  accessToken: string;

  @ApiProperty({ description: "JWT refresh token" })
  refreshToken: string;

  @ApiProperty({ description: "Access token TTL in seconds", example: 3600 })
  expiresIn: number;

  @ApiProperty({ description: "Token type (usually Bearer)", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "Authenticated user profile", type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}
