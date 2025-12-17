export interface ResumeEntity {
  id: string;
  studentUserId: string;
  jobTitle: string;
  sessionType: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  status: 'uploaded' | 'final' | 'deleted';
  finalSetAt?: Date;
  mentorUserId?: string;
  billedAt?: Date;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeDetail {
  id: string;
  studentUserId: string;
  jobTitle: string;
  sessionType: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  status: 'uploaded' | 'final' | 'deleted';
  finalSetAt?: Date;
  mentorUserId?: string;
  billedAt?: Date;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

