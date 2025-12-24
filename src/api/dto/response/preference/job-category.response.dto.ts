import { ApiProperty } from '@nestjs/swagger';

/**
 * Job Category Response DTO
 * 岗位类别响应(Job Category Response)
 */
export class JobCategoryResponseDto {
  @ApiProperty({
    description: 'Job category ID',
    example: 'software_engineer',
  })
  id: string;

  @ApiProperty({
    description: 'Job category description',
    example: 'Software development and engineering positions',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Job category status',
    example: 'active',
    nullable: true,
  })
  status: string | null;

  @ApiProperty({
    description: 'Record creation time',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  createdTime: Date | null;

  @ApiProperty({
    description: 'Record last modification time',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  modifiedTime: Date | null;

  @ApiProperty({
    description: 'User ID who created this record',
    nullable: true,
  })
  createdBy: string | null;

  @ApiProperty({
    description: 'User ID who last updated this record',
    nullable: true,
  })
  updatedBy: string | null;
}

/**
 * Job Category List Response DTO
 * 岗位类别列表响应(Job Category List Response)
 */
export class JobCategoryListResponseDto {
  @ApiProperty({
    description: 'List of job categories',
    type: [JobCategoryResponseDto],
  })
  data: JobCategoryResponseDto[];

  @ApiProperty({
    description: 'Total number of records',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  pageSize: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

