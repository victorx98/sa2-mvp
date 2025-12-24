import { ApiProperty } from '@nestjs/swagger';

/**
 * Job Title Response DTO
 * 岗位名称响应(Job Title Response)
 */
export class JobTitleResponseDto {
  @ApiProperty({
    description: 'Job title ID',
    example: 'senior_software_engineer',
  })
  id: string;

  @ApiProperty({
    description: 'Job title description',
    example: 'Senior Software Engineer with 5+ years experience',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Job title status',
    example: 'active',
    nullable: true,
  })
  status: string | null;

  @ApiProperty({
    description: 'Job category ID',
    example: 'software_engineer',
    nullable: true,
  })
  jobCategoryId: string | null;

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
 * Job Title List Response DTO
 * 岗位名称列表响应(Job Title List Response)
 */
export class JobTitleListResponseDto {
  @ApiProperty({
    description: 'List of job titles',
    type: [JobTitleResponseDto],
  })
  data: JobTitleResponseDto[];

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

