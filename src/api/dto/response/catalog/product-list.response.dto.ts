import { ApiProperty } from '@nestjs/swagger';
import { ProductItemResponseDto } from './product.response.dto';

/**
 * Product list item response DTO [产品列表项响应DTO]
 * Simplified product info for list display [用于列表展示的简化产品信息]
 */
export class ProductListItemResponseDto {
  @ApiProperty({ description: 'Product ID (UUID) [产品ID]', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Product name [产品名称]', example: 'Premium Mentoring Package' })
  name!: string;

  @ApiProperty({ description: 'Product status [产品状态]', example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ description: 'Base price [基础价格]', example: 999 })
  price!: number;

  @ApiProperty({ description: 'Currency code [货币代码]', example: 'USD' })
  currency!: string;

  @ApiProperty({ description: 'Product code [产品编码]', example: 'PREMIUM_MENTORING_2025' })
  code!: string;

  @ApiProperty({ description: 'Number of entitlement items [权益项数量]', example: 5 })
  itemCount!: number;

  @ApiProperty({ description: 'Creation time (ISO 8601) [创建时间]', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update time (ISO 8601) [最后更新时间]', format: 'date-time' })
  updatedAt!: string;
}

/**
 * Paginated product list response DTO [分页产品列表响应DTO]
 */
export class ProductListResponseDto {
  @ApiProperty({
    description: 'Product list data [产品列表数据]',
    type: [ProductListItemResponseDto],
    isArray: true,
  })
  data!: ProductListItemResponseDto[];

  @ApiProperty({ description: 'Total number of records [总记录数]', example: 150 })
  total!: number;

  @ApiProperty({ description: 'Current page number [当前页码]', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Number of items per page [每页条数]', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: 'Total number of pages [总页数]', example: 8 })
  totalPages!: number;
}
