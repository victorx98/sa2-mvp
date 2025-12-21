import { ApiProperty } from '@nestjs/swagger';

/**
 * Session Type Item Response DTO
 */
export class SessionTypeItemResponseDto {
  @ApiProperty({ description: 'Session type ID' })
  id: string;

  @ApiProperty({ description: 'Session type code' })
  code: string;

  @ApiProperty({ description: 'Session type name (i18n)' })
  name: Record<string, string>;

  @ApiProperty({ description: 'Is billing enabled' })
  isBilling: boolean;
}

/**
 * Session Type Response DTO (grouped by service type)
 */
export class SessionTypeResponseDto {
  @ApiProperty({ description: 'Service type code (e.g., External, Internal)' })
  serviceTypeCode: string;

  @ApiProperty({
    description: 'Session types under this service type',
    type: [SessionTypeItemResponseDto],
  })
  sessionTypes: SessionTypeItemResponseDto[];
}

