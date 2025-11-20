import { ApiProperty } from "@nestjs/swagger";

export class StudentSummaryResponseDto {
  @ApiProperty({ description: "Student record ID" })
  id: string;

  @ApiProperty({ description: "Associated user ID" })
  userId: string;

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
    description: "Fulltime start date",
    type: String,
    format: "date-time",
    nullable: true,
  })
  fulltimeStartdate: Date | null;

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

  @ApiProperty({ description: "Student nickname", required: false })
  nickname: string;

  @ApiProperty({ description: "Student Chinese nickname", required: false })
  cnNickname: string;

  @ApiProperty({ description: "Country/region", required: false })
  country: string;

  @ApiProperty({ description: "Gender", required: false })
  gender: string;

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
