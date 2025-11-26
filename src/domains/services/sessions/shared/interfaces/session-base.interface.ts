import { SessionType, SessionStatus } from '../enums/session-type.enum';

/**
 * Base interface for all session entities
 */
export interface ISessionBase {
  id: string;
  meeting_id: string;
  session_type: SessionType;
  session_type_id: string;
  student_user_id: string;
  status: SessionStatus;
  scheduled_at: Date;
  completed_at: Date | null;
  cancelled_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

