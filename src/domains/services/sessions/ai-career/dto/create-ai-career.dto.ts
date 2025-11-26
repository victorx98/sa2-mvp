import { IsNotEmpty, IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionType } from '../../shared/enums/session-type.enum';

/**
 * DTO for creating an AI career session
 */
export class CreateAiCareerDto {
  @IsNotEmpty()
  @IsUUID()
  meetingId: string;

  @IsNotEmpty()
  @IsEnum(SessionType)
  sessionType: SessionType = SessionType.AI_CAREER;

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

