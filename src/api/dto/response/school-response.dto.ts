import { ApiProperty } from "@nestjs/swagger";

export class SchoolResponseDto {
  @ApiProperty({ description: "School ID" })
  id: string;

  @ApiProperty({ description: "School name in Chinese" })
  nameZh: string;

  @ApiProperty({ description: "School name in English" })
  nameEn: string;

  @ApiProperty({
    description: "ISO country/region code (e.g., CN, US)",
    required: false,
    nullable: true,
  })
  countryCode: string | null;

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

