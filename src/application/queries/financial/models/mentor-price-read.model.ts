/**
 * Mentor Price Read Model
 * 导师价格查询输出模型
 */
export interface MentorPriceReadModel {
  id: string;
  mentorUserId: string;
  serviceTypeId: string | null;
  sessionTypeCode: string | null;
  packageCode: string | null;
  price: string;
  currency: string;
  status: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  mentorId: string;
  name_cn: string | null;
  name_en: string | null;
}

