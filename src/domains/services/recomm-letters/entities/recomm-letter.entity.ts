/**
 * Recommendation Letter Entity
 * 
 * Domain entity for recommendation letters
 */
export interface RecommLetterEntity {
  id: string;
  studentUserId: string;
  letterTypeId: string;
  packageTypeId: string | null;
  serviceType: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  status: 'uploaded' | 'deleted';
  mentorUserId: string | null;
  billedAt: Date | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

