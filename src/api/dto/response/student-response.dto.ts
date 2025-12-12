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
    description: "Undergraduate graduation date",
    type: String,
    format: "date-time",
    nullable: true,
  })
  underGraduationDate: Date | null;

  @ApiProperty({
    description: "Graduate graduation date",
    type: String,
    format: "date-time",
    nullable: true,
  })
  graduateGraduationDate: Date | null;

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

/**
 * Student Counselor View Response DTO
 * 顾问视图的学生列表响应，包含完整的学校名称和专业名称
 */
export class StudentCounselorViewResponseDto {
  @ApiProperty({ description: "Student record ID" })
  id: string;

  @ApiProperty({ description: "Student status" })
  status: string;

  @ApiProperty({ description: "Undergraduate major ID", required: false })
  underMajor: string;

  @ApiProperty({ description: "Undergraduate college ID", required: false })
  underCollege: string;

  @ApiProperty({ description: "Graduate major ID", required: false })
  graduateMajor: string;

  @ApiProperty({ description: "Graduate college ID", required: false })
  graduateCollege: string;

  @ApiProperty({ description: "High school ID", required: false })
  highSchool: string;

  @ApiProperty({ description: "AI generated resume summary", required: false })
  aiResumeSummary: string;

  @ApiProperty({
    description: "Customer importance label",
    required: false,
  })
  customerImportance: string;

  @ApiProperty({
    description: "Undergraduate graduation date",
    type: String,
    format: "date-time",
    nullable: true,
  })
  underGraduationDate: Date | null;

  @ApiProperty({
    description: "Graduate graduation date",
    type: String,
    format: "date-time",
    nullable: true,
  })
  graduateGraduationDate: Date | null;

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

  // 学校名称
  @ApiProperty({ description: "Undergraduate college Chinese name", required: false })
  underCollegeNameZh?: string;

  @ApiProperty({ description: "Undergraduate college English name", required: false })
  underCollegeNameEn?: string;

  @ApiProperty({ description: "Graduate college Chinese name", required: false })
  graduateCollegeNameZh?: string;

  @ApiProperty({ description: "Graduate college English name", required: false })
  graduateCollegeNameEn?: string;

  @ApiProperty({ description: "High school Chinese name", required: false })
  highSchoolNameZh?: string;

  @ApiProperty({ description: "High school English name", required: false })
  highSchoolNameEn?: string;

  // 专业名称
  @ApiProperty({ description: "Undergraduate major Chinese name", required: false })
  underMajorNameZh?: string;

  @ApiProperty({ description: "Undergraduate major English name", required: false })
  underMajorNameEn?: string;

  @ApiProperty({ description: "Graduate major Chinese name", required: false })
  graduateMajorNameZh?: string;

  @ApiProperty({ description: "Graduate major English name", required: false })
  graduateMajorNameEn?: string;

  // 顾问关联信息
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

/**
 * Paginated Student Counselor View Response DTO
 * 分页的顾问视图学生列表响应
 */
export class PaginatedStudentCounselorViewResponseDto {
  @ApiProperty({
    description: "Student list data",
    type: [StudentCounselorViewResponseDto],
  })
  data: StudentCounselorViewResponseDto[];

  @ApiProperty({
    description: "Total number of records",
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: "Number of items per page",
    example: 20,
  })
  pageSize: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 5,
  })
  totalPages: number;
}
