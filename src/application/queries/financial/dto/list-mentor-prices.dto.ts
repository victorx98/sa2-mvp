/**
 * List Mentor Prices DTO (Application Layer Internal)
 * 导师价格列表查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 */

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface ListMentorPricesDto {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  mentorUserId?: string;
  status?: string;
}

