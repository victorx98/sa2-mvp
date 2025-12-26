export interface QueryClassSessionsDto {
  page?: number;
  pageSize?: number;
  classId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}
