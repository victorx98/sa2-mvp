import { ApiProperty } from "@nestjs/swagger";
import { Gender, Country } from "@shared/types/identity-enums";

export class UserResponseDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ 
    description: "User gender", 
    required: false,
    enum: Gender 
  })
  gender?: Gender;

  @ApiProperty({ description: "English name", required: false })
  nameEn?: string;

  @ApiProperty({ description: "Chinese name", required: false })
  nameZh?: string;

  @ApiProperty({
    description: "Account status (e.g., active, suspended)",
    required: false,
  })
  status?: string;

  @ApiProperty({ description: "Email address", required: false })
  email?: string;

  @ApiProperty({ 
    description: "ISO 3166-1 alpha-2 country code (US, CN, GB, CA)", 
    required: false,
    enum: Country 
  })
  country?: Country;

  @ApiProperty({
    description: "User roles",
    type: [String],
    required: false,
    example: ["student"],
  })
  roles?: string[];

  @ApiProperty({
    description: "Creation timestamp",
    type: String,
    format: "date-time",
    required: false,
  })
  createdTime?: Date;

  @ApiProperty({
    description: "Last modification timestamp",
    type: String,
    format: "date-time",
    required: false,
  })
  modifiedTime?: Date;
}
