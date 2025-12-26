export interface QueryClassesDto {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
}

export interface GetClassMembersDto {
  classId: string;
}
