import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for querying session types
 */
export class GetSessionTypesDto {
  @ApiProperty({
    description: "Filter by service type code (e.g., External, Internal)",
    required: false,
    example: 'External',
  })
  @IsOptional()
  @IsString()
  serviceTypeCode?: string;
}

/**
 * Response DTO for session type
 */
export class SessionTypeDto {
  @ApiProperty({ description: "Session type ID", example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @ApiProperty({ description: "Session type code", example: "regular_mentoring" })
  code: string;

  @ApiProperty({ description: "Session type name", example: "Regular Mentoring" })
  name: string;

  @ApiProperty({ description: "Service type code", example: "External" })
  serviceTypeCode: string;

  @ApiProperty({ description: "Template ID", nullable: true, required: false })
  templateId: string | null;

  @ApiProperty({ description: "Whether this session type is billable" })
  isBilling: boolean;

  @ApiProperty({ description: "Creation timestamp", type: String, format: "date-time" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp", type: String, format: "date-time" })
  updatedAt: Date;
}

