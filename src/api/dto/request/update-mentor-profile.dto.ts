import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsNumber, IsUUID, Min, Max } from "class-validator";

export class UpdateMentorProfileDto {
  @ApiProperty({ description: "Mentor status", required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: "Mentor type", required: false, nullable: true })
  @IsOptional()
  @IsString()
  type?: string | null;

  @ApiProperty({ description: "Company name", required: false, nullable: true })
  @IsOptional()
  @IsString()
  company?: string | null;

  @ApiProperty({ description: "Company title", required: false, nullable: true })
  @IsOptional()
  @IsString()
  companyTitle?: string | null;

  @ApiProperty({ description: "Brief introduction", required: false, nullable: true })
  @IsOptional()
  @IsString()
  briefIntro?: string | null;

  @ApiProperty({ description: "High school ID", required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  highSchool?: string | null;

  @ApiProperty({ description: "Location", required: false, nullable: true })
  @IsOptional()
  @IsString()
  location?: string | null;

  @ApiProperty({ description: "Level", required: false, nullable: true })
  @IsOptional()
  @IsString()
  level?: string | null;

  @ApiProperty({ description: "Rating", required: false, nullable: true, type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number | null;

  @ApiProperty({ description: "Undergraduate college ID", required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  underCollege?: string | null;

  @ApiProperty({ description: "Undergraduate major ID", required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  underMajor?: string | null;

  @ApiProperty({ description: "Graduate college ID", required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  graduateCollege?: string | null;

  @ApiProperty({ description: "Graduate major ID", required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  graduateMajor?: string | null;
}

