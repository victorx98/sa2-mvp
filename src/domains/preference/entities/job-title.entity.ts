/**
 * Job Title Entity
 * 岗位名称(Job Title)实体定义
 */
export interface JobTitleEntity {
  id: string;
  description: string | null;
  status: string | null;
  jobCategoryId: string | null;
  createdTime: Date | null;
  modifiedTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Create Job Title DTO
 * 创建岗位名称(Create Job Title)数据传输对象
 */
export interface CreateJobTitleDto {
  id: string;
  description?: string;
  jobCategoryId?: string;
  createdBy: string;
}

/**
 * Update Job Title DTO
 * 更新岗位名称(Update Job Title)数据传输对象
 */
export interface UpdateJobTitleDto {
  description?: string;
  status?: string;
  jobCategoryId?: string;
  updatedBy: string;
}

/**
 * Job Title Query Options
 * 岗位名称查询选项(Job Title Query Options)
 */
export interface JobTitleQueryOptions {
  search?: string;
  status?: string;
  jobCategoryId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

