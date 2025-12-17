import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LoginInput } from "@shared/types/auth.types";

/**
 * 登录请求 DTO
 * 实现 LoginInput 接口，确保字段一致性，并添加 HTTP 校验装饰器
 */
export class LoginDto implements LoginInput {
  @ApiProperty({ description: "User email address", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "User password", example: "password123" })
  @IsNotEmpty()
  @IsString()
  password: string;
}
