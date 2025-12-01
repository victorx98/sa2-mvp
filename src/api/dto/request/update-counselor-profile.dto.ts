import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateCounselorProfileDto {
  @ApiProperty({ description: "Counselor status", required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

