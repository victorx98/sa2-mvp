import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Cancel Bill Resume Request DTO
 */
export class CancelBillResumeRequestDto {
  @ApiProperty({ description: 'Service type', required: false })
  @IsString()
  @IsOptional()
  serviceType?: string;

  @ApiProperty({ description: 'Description', required: false, maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

