import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { USER_ROLES } from "@domains/identity/user/user.constants";
import { Gender, Country } from "@shared/types/identity-enums";
import { RegisterInput } from "@shared/types/auth.types";

/**
 * 注册请求 DTO
 * 实现 RegisterInput 接口，确保字段一致性，并添加 HTTP 校验装饰器
 */
export class RegisterDto implements RegisterInput {
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

  @ApiProperty({ 
    description: "User gender", 
    required: false, 
    enum: Gender,
    example: Gender.MALE 
  })
  @IsOptional()
  @IsEnum(Gender, { message: "Gender must be either 'male' or 'female'" })
  gender?: Gender;

  @ApiProperty({ 
    description: "ISO 3166-1 alpha-2 country code (US, CN, GB, CA)", 
    required: false, 
    enum: Country,
    example: Country.US 
  })
  @IsOptional()
  @IsEnum(Country, { message: "Country must be one of: US, CN, GB, CA" })
  country?: Country;

  @ApiProperty({ description: "User role", enum: USER_ROLES, example: "student" })
  @IsNotEmpty()
  @IsString()
  @IsIn(USER_ROLES)
  role: string;
}
