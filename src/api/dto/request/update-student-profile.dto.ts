import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsDateString, IsUUID, IsEnum } from "class-validator";
import { Gender, Country } from "@shared/types/identity-enums";

export class UpdateStudentProfileDto {
  // ===== User 表字段（基础身份信息，可选）=====
  @ApiProperty({ description: "User English name", required: false })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiProperty({ description: "User Chinese name", required: false })
  @IsOptional()
  @IsString()
  nameZh?: string;

  @ApiProperty({
    description: "User gender",
    required: false,
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    description: "ISO 3166-1 alpha-2 country code",
    required: false,
    enum: Country,
    example: Country.US,
  })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  // ===== Student Profile 表字段 =====
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

