/**
 * Product Query DTOs (Application Layer Internal)
 * 产品查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 */

export interface ProductFilterDto {
  status?: string;
  name?: string;
  code?: string;
  userPersona?: string;
  marketingLabel?: string;
  isRecommended?: boolean;
  includeDeleted?: boolean;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  availableAt?: Date;
}

export interface PaginationDto {
  page?: number;
  pageSize?: number;
}

export interface SortDto {
  field?: string;
  order?: 'asc' | 'desc';
}

export interface SearchProductsDto {
  filter: ProductFilterDto;
  pagination?: PaginationDto;
  sort?: SortDto;
}

export interface GetProductDetailDto {
  id: string;
}

