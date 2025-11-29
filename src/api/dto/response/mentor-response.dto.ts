import { ApiProperty } from "@nestjs/swagger";
import { Gender, Country } from "@shared/types/identity-enums";

export class MentorSummaryResponseDto {
  @ApiProperty({ description: "Mentor ID" })
  id: string;

  @ApiProperty({ description: "Associated user ID" })
  userId: string;

  @ApiProperty({ description: "Mentor status", required: false })
  status?: string;

  @ApiProperty({ description: "Mentor type", required: false })
  type?: string;

  @ApiProperty({ description: "Company", required: false })
  company?: string;

  @ApiProperty({ description: "Company title", required: false })
  companyTitle?: string;

  @ApiProperty({ description: "Brief introduction", required: false })
  briefIntro?: string;

  @ApiProperty({ description: "School", required: false })
  school?: string;

  @ApiProperty({ description: "Location", required: false })
  location?: string;

  @ApiProperty({ description: "Mentor level", required: false })
  level?: string;

  @ApiProperty({
    description: "Mentor rating",
    nullable: true,
    required: false,
  })
  rating: number | null;

  @ApiProperty({
    description: "Record created time",
    type: String,
    format: "date-time",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Record last modified time",
    type: String,
    format: "date-time",
  })
  modifiedAt: Date;

  @ApiProperty({ description: "Email address" })
  email: string;

  @ApiProperty({ description: "English name", required: false })
  nameEn?: string;

  @ApiProperty({ description: "Chinese name", required: false })
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
}

