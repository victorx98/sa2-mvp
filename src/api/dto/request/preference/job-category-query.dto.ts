import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Job Category Query Request DTO
 * 岗位类别查询请求(Job Category Query Request)
 */
export class JobCategoryQueryDto {
  @ApiProperty({
    description: 'Search keyword (searches in ID and description)',
    required: false,
    example: 'engineer',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Filter by status',
    required: false,
    example: 'active',
    enum: ['active', 'inactive', 'deleted'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive', 'deleted'])
  status?: string;

  @ApiProperty({
    description: 'Page number (starts from 1)',
    required: false,
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiProperty({
    description: 'Sort by field',
    required: false,
    default: 'createdTime',
    enum: ['id', 'description', 'status', 'createdTime', 'modifiedTime'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['id', 'description', 'status', 'createdTime', 'modifiedTime'])
  sortBy?: string = 'createdTime';

  @ApiProperty({
    description: 'Sort order',
    required: false,
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

