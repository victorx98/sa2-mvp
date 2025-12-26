/**
 * Job Title Read Model
 * 岗位名称查询输出模型
 */
export interface JobTitleReadModel {
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

