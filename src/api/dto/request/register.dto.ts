import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { USER_ROLES } from "@domains/identity/user/user.constants";

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  cnNickname?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(USER_ROLES)
  role: string;
}
