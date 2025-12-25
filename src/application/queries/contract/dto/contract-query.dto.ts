/**
 * Contract Query DTOs (Application Layer Internal)
 * 合同查询输入DTO（应用层内部）
 * 
 * No validation decorators - validation is done at API layer
 */

export interface GetStudentContractsDto {
  filters?: {
    studentId?: string;
    status?: string;
    productName?: string;
  };
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  sort?: {
    field?: string;
    direction?: 'asc' | 'desc';
  };
}

export interface GetServiceConsumptionDto {
  filters?: {
    studentId?: string;
    contractId?: string;
    serviceTypeCode?: string;
    status?: string;
  };
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  sort?: {
    field?: string;
    direction?: 'asc' | 'desc';
  };
}

