import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Set Final Request DTO
 */
export class SetFinalRequestDto {
  @ApiProperty({ description: 'Description', required: false, maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

