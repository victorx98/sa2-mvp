import { IsNotEmpty, IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionType } from '../../shared/enums/session-type.enum';

/**
 * DTO for creating a gap analysis session
 */
export class CreateGapAnalysisDto {
  @IsOptional()
  @IsUUID()
  meetingId?: string; // Optional - filled in async flow after meeting creation

  @IsNotEmpty()
  @IsEnum(SessionType)
  sessionType: SessionType = SessionType.GAP_ANALYSIS;

  @IsNotEmpty()
  @IsUUID()
  sessionTypeId: string;

  @IsOptional()
  @IsString()
  serviceType?: string; // Business-level service type

  @IsOptional()
  @IsUUID()
  serviceHoldId?: string; // Reference to initial booking service hold

  @IsNotEmpty()
  @IsUUID()
  studentUserId: string;

  @IsNotEmpty()
  @IsUUID()
  mentorUserId: string;

  @IsOptional()
  @IsUUID()
  createdByCounselorId?: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;
}

