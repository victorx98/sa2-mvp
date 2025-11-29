import { ApiProperty } from "@nestjs/swagger";
import { Gender, Country } from "@shared/types/identity-enums";

export class StudentSummaryResponseDto {
  @ApiProperty({ description: "Student record ID" })
  id: string;

  @ApiProperty({ description: "Student status" })
  status: string;

  @ApiProperty({ description: "Undergraduate major", required: false })
  underMajor: string;

  @ApiProperty({ description: "Undergraduate college", required: false })
  underCollege: string;

  @ApiProperty({ description: "Graduate major", required: false })
  graduateMajor: string;

  @ApiProperty({ description: "Graduate college", required: false })
  graduateCollege: string;

  @ApiProperty({ description: "AI generated resume summary", required: false })
  aiResumeSummary: string;

  @ApiProperty({
    description: "Customer importance label",
    required: false,
  })
  customerImportance: string;

  @ApiProperty({
    description: "Graduation date",
    type: String,
    format: "date-time",
    nullable: true,
  })
  graduationDate: Date | null;

  @ApiProperty({ description: "Background information", required: false })
  backgroundInfo: string;

  @ApiProperty({ description: "Grades information", required: false })
  grades: string;

  @ApiProperty({
    description: "Record creation time",
    type: String,
    format: "date-time",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Record last modification time",
    type: String,
    format: "date-time",
  })
  modifiedAt: Date;

  @ApiProperty({ description: "Student email", required: false })
  email: string;

  @ApiProperty({ description: "Student English name", required: false })
  nameEn?: string;

  @ApiProperty({ description: "Student Chinese name", required: false })
  nameZh?: string;

  @ApiProperty({ 
    description: "ISO 3166-1 alpha-2 country code (US, CN, GB, CA)", 
    required: false,
    enum: Country 
  })
  country?: Country;

  @ApiProperty({ 
    description: "Gender", 
    required: false,
    enum: Gender 
  })
  gender?: Gender;

  @ApiProperty({
    description: "Counselor assignment status",
    required: false,
  })
  counselorStatus?: string;

  @ApiProperty({
    description: "Counselor assignment type",
    required: false,
  })
  counselorType?: string;
}
