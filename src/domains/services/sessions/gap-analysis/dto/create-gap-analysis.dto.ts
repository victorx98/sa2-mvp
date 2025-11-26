import { IsNotEmpty, IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionType } from '../../shared/enums/session-type.enum';

/**
 * DTO for creating a gap analysis session
 */
export class CreateGapAnalysisDto {
  @IsNotEmpty()
  @IsUUID()
  meetingId: string;

  @IsNotEmpty()
  @IsEnum(SessionType)
  sessionType: SessionType = SessionType.GAP_ANALYSIS;

  @IsNotEmpty()
  @IsUUID()
  sessionTypeId: string;

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

