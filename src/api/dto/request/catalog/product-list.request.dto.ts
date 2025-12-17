import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductStatus } from '@shared/types/catalog-enums';

/**
 * Product List Query DTO [产品列表查询DTO]
 * Used for paginated product listing with filters [用于带筛选的分页产品列表查询]
 */
export class ProductListQueryDto {
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

  @ApiPropertyOptional({ description: 'Product status filter [产品状态筛选]', enum: ProductStatus, example: 'ACTIVE' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Product type filter [产品类型筛选]', example: 'mentoring_package' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Keyword search (searches in name and title) [关键词搜索]', example: 'premium course' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Minimum price filter [最低价格筛选]', example: 100 })
  @IsOptional()
  @IsString()
  minPrice?: string;

  @ApiPropertyOptional({ description: 'Maximum price filter [最高价格筛选]', example: 1000 })
  @IsOptional()
  @IsString()
  maxPrice?: string;
}
