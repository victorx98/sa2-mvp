import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * Update Job Category Request DTO
 * 更新岗位类别请求(Update Job Category Request)
 */
export class UpdateJobCategoryDto {
  @ApiProperty({
    description: 'Job category description',
    example: 'Updated description for software engineering positions',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Job category status',
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}

