import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Get Session Types Request DTO
 */
export class GetSessionTypesRequestDto {
  @ApiProperty({
    description: 'Filter by service type code (e.g., External, Internal)',
    required: false,
    example: 'External',
  })
  @IsOptional()
  @IsString()
  serviceTypeCode?: string;
}

