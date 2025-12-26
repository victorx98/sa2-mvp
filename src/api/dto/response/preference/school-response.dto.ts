import { ApiProperty } from "@nestjs/swagger";
import { Country } from "@shared/types/identity-enums";

export class SchoolResponseDto {
  @ApiProperty({ description: "School ID" })
  id: string;

  @ApiProperty({ description: "School name in Chinese" })
  nameZh: string;

  @ApiProperty({ description: "School name in English" })
  nameEn: string;

  @ApiProperty({
    description: "ISO 3166-1 alpha-2 country code (US, CN, GB, CA)",
    required: false,
    nullable: true,
    enum: Country,
    example: Country.US,
  })
  country: Country | null;

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
}

