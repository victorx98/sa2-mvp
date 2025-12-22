import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Create Recommendation Letter Type Request DTO
 */
export class CreateRecommLetterTypeDto {
  @ApiProperty({
    description: 'Type code (unique identifier)',
    example: 'online_5',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  typeCode: string;

  @ApiProperty({
    description: 'Type name (display name)',
    example: '5 Online',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  typeName: string;

  @ApiProperty({
    description: 'Service type code (e.g., External, Internal)',
    example: 'External',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  serviceTypeCode: string;

  @ApiPropertyOptional({
    description: 'Parent type ID (for hierarchical structure)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

