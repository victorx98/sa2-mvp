import { SessionStatus } from '../value-objects/session-status.vo';

/**
 * Session Search Criteria
 * 
 * Query conditions (not a DTO)
 */
export interface SessionSearchCriteria {
  status?: SessionStatus;
  studentId?: string;
  mentorId?: string;
  counselorId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

