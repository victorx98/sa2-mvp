import { ApiProperty } from "@nestjs/swagger";

export class MajorResponseDto {
  @ApiProperty({ description: "Major ID" })
  id: string;

  @ApiProperty({ description: "Major name in Chinese" })
  nameZh: string;

  @ApiProperty({ description: "Major name in English" })
  nameEn: string;

  @ApiProperty({
    description: "Degree level (e.g., bachelor, master, phd)",
    required: false,
    nullable: true,
  })
  degreeLevel: string | null;

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

