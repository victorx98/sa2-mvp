/**
 * Job Category Entity
 * 岗位类别(Job Category)实体定义
 */
export interface JobCategoryEntity {
  id: string;
  description: string | null;
  status: string | null;
  createdTime: Date | null;
  modifiedTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Create Job Category DTO
 * 创建岗位类别(Create Job Category)数据传输对象
 */
export interface CreateJobCategoryDto {
  id: string;
  description?: string;
  createdBy: string;
}

/**
 * Update Job Category DTO
 * 更新岗位类别(Update Job Category)数据传输对象
 */
export interface UpdateJobCategoryDto {
  description?: string;
  status?: string;
  updatedBy: string;
}

/**
 * Job Category Query Options
 * 岗位类别查询选项(Job Category Query Options)
 */
export interface JobCategoryQueryOptions {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

