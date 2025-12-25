/**
 * Job Application Read Model
 * 投递申请查询输出模型
 * 
 * Read Model for job application query results with related user information
 * Field names match API output conventions
 */
export interface JobApplicationReadModel {
  // Job application fields
  id: string;
  studentId: string;
  recommendedJobId: string | null;
  applicationType: string;
  coverLetter: string | null;
  customAnswers: Record<string, unknown> | null;
  status: string;
  result: string | null;
  resultReason: string | null;
  submittedAt: string; // ISO date string
  updatedAt: string; // ISO date string
  notes: string | null;
  assignedMentorId: string | null;
  recommendedBy: string | null;
  recommendedAt: string | null; // ISO date string
  objectId: string | null;
  jobId: string | null;
  jobLink: string | null;
  jobType: string | null;
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  jobCategories: string[] | null;
  normalJobTitle: string | null;
  level: string | null;

  // Related user information
  student: {
    id: string;
    name_cn: string | null;
    name_en: string | null;
  };
  mentor: {
    id: string;
    name_cn: string | null;
    name_en: string | null;
  } | null;
  counselor: {
    id: string;
    name_cn: string | null;
    name_en: string | null;
  } | null;
}

