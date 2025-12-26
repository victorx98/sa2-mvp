export interface QueryMockInterviewsDto {
  studentId?: string;
  counselorId?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  excludeDeleted?: boolean;
}

export interface QueryMockInterviewsByIdsDto {
  studentIds: string[];
  page?: number;
  pageSize?: number;
  status?: string;
  excludeDeleted?: boolean;
}
