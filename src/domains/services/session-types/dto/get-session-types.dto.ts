import { IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for querying session types
 */
export class GetSessionTypesDto {
  @ApiProperty({
    description: "Filter by session type code",
    enum: ['External', 'Internal'],
    required: false,
  })
  @IsOptional()
  @IsIn(['External', 'Internal'])
  code?: 'External' | 'Internal';
}

/**
 * Response DTO for session type
 */
export class SessionTypeDto {
  @ApiProperty({ description: "Session type ID" })
  id: string;

  @ApiProperty({ description: "Session type code" })
  code: string;

  @ApiProperty({ description: "Session type name" })
  name: string;

  @ApiProperty({ description: "Template ID", nullable: true, required: false })
  template_id: string | null;

  @ApiProperty({ description: "Whether this session type is billable" })
  is_billing: boolean;

  @ApiProperty({ description: "Creation timestamp", type: String, format: "date-time" })
  created_at: Date;

  @ApiProperty({ description: "Last update timestamp", type: String, format: "date-time" })
  updated_at: Date;
}

