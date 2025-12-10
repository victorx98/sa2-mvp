import { IsNotEmpty, IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { CommSessionType, CommSessionStatus } from '../entities/comm-session.entity';

/**
 * Create Comm Session DTO
 *
 * Passed from Application layer to Domain layer
 * meetingId can be null for async meeting creation flow
 */
export class CreateCommSessionDto {
  @IsOptional()
  @IsUUID()
  meetingId?: string; // Optional - filled in async flow after meeting creation

  @IsNotEmpty()
  @IsEnum(CommSessionType)
  sessionType: CommSessionType = CommSessionType.COMM_SESSION;

  @IsNotEmpty()
  @IsUUID()
  studentUserId: string;

  @IsOptional()
  @IsUUID()
  mentorUserId?: string;

  @IsOptional()
  @IsUUID()
  counselorUserId?: string;

  @IsNotEmpty()
  @IsUUID()
  createdByCounselorId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string; // ISO string format

  @IsOptional()
  @IsEnum(CommSessionStatus)
  status?: CommSessionStatus; // Optional, defaults to PENDING_MEETING
}
