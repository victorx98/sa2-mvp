import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * Update Job Title Request DTO
 * 更新岗位名称请求(Update Job Title Request)
 */
export class UpdateJobTitleDto {
  @ApiProperty({
    description: 'Job title description',
    example: 'Updated description for senior software engineer position',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Job title status',
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @ApiProperty({
    description: 'Job category ID',
    example: 'software_engineer',
    required: false,
  })
  @IsString()
  @IsOptional()
  jobCategoryId?: string;
}

