import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Bill Recommendation Letter Request DTO
 */
export class BillRecommLetterRequestDto {
  @ApiProperty({ description: 'Student user ID' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: 'Mentor user ID' })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

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

