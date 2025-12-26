/**
 * Job Read Model
 * 岗位查询输出模型
 * 
 * Read Model for job query results
 * Field names match API output conventions
 */
export interface JobReadModel {
  id: string;
  title: string;
  companyName: string;
  jobLocations: string[] | null;
  jobTypes: string[] | null;
  level: string | null;
  h1b: string;
  usCitizenship: string;
  postDate: Date | null;
  applicationDeadline: Date | null; // Unified field name (matches API)
  jobApplicationType: string[];
  status: string;
  normalizedJobTitles: string[] | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  benefits: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  experienceYearsMin: number | null;
  experienceYearsMax: number | null;
  educationLevel: string | null;
  skills: string[] | null;
  remoteWorkOption: string | null;
  source: string | null;
  sourceUrl: string | null;
  companySize: string | null;
  companyIndustry: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

