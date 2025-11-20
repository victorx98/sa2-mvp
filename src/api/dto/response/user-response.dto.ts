import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User gender", required: false })
  gender?: string;

  @ApiProperty({ description: "English nickname", required: false })
  nickname?: string;

  @ApiProperty({ description: "Chinese nickname", required: false })
  cnNickname?: string;

  @ApiProperty({
    description: "Account status (e.g., active, suspended)",
    required: false,
  })
  status?: string;

  @ApiProperty({ description: "Email address", required: false })
  email?: string;

  @ApiProperty({ description: "Country or region", required: false })
  country?: string;

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
