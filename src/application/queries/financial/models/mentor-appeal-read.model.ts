/**
 * Mentor Appeal Read Model
 * 导师申诉查询输出模型
 */
export interface MentorAppealReadModel {
  id: string;
  title: string | null;
  appealType: string;
  appealAmount: string;
  currency: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  mentorId: string;
  mentorNameCn: string | null;
  mentorNameEn: string | null;
  counselorId: string;
  counselorNameCn: string | null;
  counselorNameEn: string | null;
  studentId: string | null;
  studentNameCn: string | null;
  studentNameEn: string | null;
  updatedByName: string;
  updatedAt: Date;
}

