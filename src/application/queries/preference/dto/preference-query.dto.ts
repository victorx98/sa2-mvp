/**
 * Preference Query DTOs (Application Layer Internal)
 * 参考数据查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 */

export interface ListJobCategoriesDto {
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListJobTitlesDto {
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

