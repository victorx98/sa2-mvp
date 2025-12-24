import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Recommendation Letter Type Response DTO (Tree Node)
 */
export class RecommLetterTypeResponseDto {
  @ApiProperty({
    description: 'Type ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Type code',
    example: 'online_package',
  })
  typeCode: string;

  @ApiProperty({
    description: 'Type name',
    example: '网申推荐信(Package)',
  })
  typeName: string;

  @ApiProperty({
    description: 'Service type code',
    example: 'External',
  })
  serviceTypeCode: string;

  @ApiPropertyOptional({
    description: 'Parent type ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  parentId: string | null;

  @ApiProperty({
    description: 'Active status',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Child types',
    type: [RecommLetterTypeResponseDto],
  })
  children: RecommLetterTypeResponseDto[];

  @ApiProperty({
    description: 'Created timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Letter Type Statistics DTO
 */
export class LetterTypeStatisticsDto {
  @ApiProperty({
    description: 'Total count',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Available count',
    example: 2,
  })
  available: number;
}

/**
 * Available Types Summary DTO
 */
export class AvailableTypesSummaryDto {
  @ApiProperty({
    description: 'Online letter statistics',
    type: LetterTypeStatisticsDto,
  })
  online: LetterTypeStatisticsDto;

  @ApiProperty({
    description: 'Paper letter statistics',
    type: LetterTypeStatisticsDto,
  })
  paper: LetterTypeStatisticsDto;
}

/**
 * Available Types Response DTO with Summary
 */
export class AvailableTypesResponseDto {
  @ApiProperty({
    description: 'Available letter types',
    type: [RecommLetterTypeResponseDto],
  })
  data: RecommLetterTypeResponseDto[];

  @ApiProperty({
    description: 'Statistics summary',
    type: AvailableTypesSummaryDto,
  })
  summary: AvailableTypesSummaryDto;
}

