import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsDateString, IsUUID } from "class-validator";

export class UpdateStudentProfileDto {
  @ApiProperty({ description: "Student status", required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: "High school ID", required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  highSchool?: string | null;

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

  @ApiProperty({ description: "AI resume summary", required: false, nullable: true })
  @IsOptional()
  @IsString()
  aiResumeSummary?: string | null;

  @ApiProperty({ description: "Customer importance", required: false, nullable: true })
  @IsOptional()
  @IsString()
  customerImportance?: string | null;

  @ApiProperty({ description: "Graduation date", required: false, nullable: true, type: String, format: "date" })
  @IsOptional()
  @IsDateString()
  graduationDate?: string | null;

  @ApiProperty({ description: "Grades information", required: false, nullable: true })
  @IsOptional()
  @IsString()
  grades?: string | null;
}

