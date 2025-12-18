import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ContractStatus } from '@shared/types/contract-enums';

/**
 * Contract List Query DTO [合同列表查询DTO]
 * Used for paginated contract listing with filters [用于带筛选的分页合同列表查询]
 */
export class ContractListQueryDto {
  @ApiPropertyOptional({ description: 'Page number (starts from 1) [页码(从1开始)]', default: 1, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page [每页条数]', default: 20, example: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Student ID for filtering [学生ID筛选]', example: '9e50af7d-5f08-4516-939f-7f765ce131b8' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Contract status filter [合同状态筛选]', enum: ContractStatus, example: 'active' })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Product ID filter [产品ID筛选]', example: '9e50af7d-5f08-4516-939f-7f765ce131b8' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Contract start date filter (ISO 8601) [合同开始日期筛选]', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Contract end date filter (ISO 8601) [合同结束日期筛选]', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Keyword search (searches in title, description) [关键词搜索]', example: 'premium' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
