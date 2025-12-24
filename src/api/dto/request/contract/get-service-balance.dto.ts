import { IsNotEmpty, IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for getting service balance
 * 获取服务余额的请求 DTO
 */
export class GetServiceBalanceDto {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsString()
  studentId: string;

  @ApiProperty({
    description: "Service type (optional)",
    example: "one_on_one_session",
    required: false,
  })
  @IsOptional()
  @IsString()
  serviceType?: string;
}

