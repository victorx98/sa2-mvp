import { SessionStatus } from '../value-objects/session-status.vo';

/**
 * Session Search Criteria
 * Defines filters for querying sessions
 */
export interface SessionSearchCriteria {
  classId?: string;
  mentorId?: string;
  status?: SessionStatus;
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

