import { IsNotEmpty, IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionType } from '../../shared/enums/session-type.enum';

/**
 * DTO for creating a regular mentoring session
 */
export class CreateRegularMentoringDto {
  @IsOptional()
  @IsUUID()
  meetingId?: string; // Optional - filled in async flow after meeting creation

  @IsNotEmpty()
  @IsEnum(SessionType)
  sessionType: SessionType = SessionType.REGULAR_MENTORING;

  @IsOptional()
  @IsUUID()
  sessionTypeId?: string; // Nullable until session_types lookup is implemented

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

