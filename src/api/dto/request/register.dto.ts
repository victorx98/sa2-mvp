import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { USER_ROLES } from "@domains/identity/user/user.constants";

export class RegisterDto {
  @ApiProperty({ description: "User email address", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "User password (minimum 6 characters)", example: "password123", minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: "User English name", example: "John Doe" })
  @IsNotEmpty()
  @IsString()
  nameEn: string;

  @ApiProperty({ description: "User Chinese name", example: "张三" })
  @IsNotEmpty()
  @IsString()
  nameZh: string;

  @ApiProperty({ description: "User gender", required: false, example: "male" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: "User country", required: false, example: "China" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ description: "User role", enum: USER_ROLES, example: "student" })
  @IsNotEmpty()
  @IsString()
  @IsIn(USER_ROLES)
  role: string;
}
