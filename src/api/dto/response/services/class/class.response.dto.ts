/**
 * Create Class Response DTO
 */
export class CreateClassResponseDto {
  classId: string;
  name: string;
  type: string;
  status: string;
}

/**
 * Update Class Response DTO
 */
export class UpdateClassResponseDto {
  classId: string;
  updated: boolean;
}

/**
 * Class Status Response DTO
 */
export class ClassStatusResponseDto {
  classId: string;
  status: string;
}

/**
 * Add Member Response DTO
 */
export class AddMemberResponseDto {
  classId: string;
  added: boolean;
  mentorId?: string;
  studentId?: string;
  counselorId?: string;
}

/**
 * Remove Member Response DTO
 */
export class RemoveMemberResponseDto {
  classId: string;
  removed: boolean;
  mentorId?: string;
  studentId?: string;
  counselorId?: string;
}

/**
 * Class List Item DTO
 */
export class ClassListItemDto {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  totalSessions: number;
  mentors: Array<{
    userId: string;
    name: { en: string; zh: string };
    pricePerSession: number;
    addedAt: Date;
  }>;
  counselors: Array<{
    userId: string;
    name: { en: string; zh: string };
    addedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get All Classes Response DTO
 */
export class GetAllClassesResponseDto {
  data: ClassListItemDto[];
  total: number;
  totalPages: number;
  pageSize: number;
  page: number;
}

