import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsIn } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Sort field [排序字段]', example: 'createdAt' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiPropertyOptional({ description: 'Sort order [排序方向]', enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

/**
 * Product Filter DTO [产品筛选DTO]
 * Used for filtering products [用于筛选产品]
 */
export class ProductFilterDto {
  @ApiPropertyOptional({ description: 'Include deleted products [包含已删除产品]' })
  @IsOptional()
  includeDeleted?: boolean;

  @ApiPropertyOptional({ description: 'Product status filter [产品状态筛选]', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Target user persona [目标用户画像]' })
  @IsOptional()
  @IsString()
  userPersona?: string;

  @ApiPropertyOptional({ description: 'Marketing label [营销标签]' })
  @IsOptional()
  @IsString()
  marketingLabel?: string;

  @ApiPropertyOptional({ description: 'Product name filter [产品名称筛选]' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Product code filter [产品编码筛选]' })
  @IsOptional()
  @IsString()
  code?: string;
}

/**
 * Pagination DTO [分页DTO]
 * Used for pagination parameters [用于分页参数]
 */
export class PaginationDto {
  @ApiPropertyOptional({ description: 'Page number [页码]', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page [每页条数]', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/**
 * Sort DTO [排序DTO]
 * Used for sorting parameters [用于排序参数]
 */
export class SortDto {
  @ApiPropertyOptional({ description: 'Sort field [排序字段]' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiPropertyOptional({ description: 'Sort order [排序方向]', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
