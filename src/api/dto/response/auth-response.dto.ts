import { ApiProperty } from "@nestjs/swagger";

export class AuthUserResponseDto {
  @ApiProperty({ description: "Supabase user ID" })
  id: string;

  @ApiProperty({ description: "User email address" })
  email: string;

  @ApiProperty({ description: "English nickname", required: false })
  nickname?: string;

  @ApiProperty({ description: "Chinese nickname", required: false })
  cnNickname?: string;

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

export class AuthResponseDto {
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
