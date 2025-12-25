/**
 * List Mentor Appeals DTO (Application Layer Internal)
 * 导师申诉列表查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 */

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface ListMentorAppealsDto {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  status?: string;
  mentorId?: string;
  counselorId?: string;
  studentId?: string;
  appealType?: string;
  paymentMonth?: string;
}

