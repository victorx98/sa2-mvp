/**
 * Job Category Read Model
 * 岗位类别查询输出模型
 */
export interface JobCategoryReadModel {
  id: string;
  nameZh: string;
  nameEn: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

