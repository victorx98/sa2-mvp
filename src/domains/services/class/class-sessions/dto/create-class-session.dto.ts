import { IsNotEmpty, IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SessionType, ClassSessionStatus } from '../entities/class-session.entity';

/**
 * DTO for creating a class session
 */
export class CreateClassSessionDto {
  @IsNotEmpty()
  @IsUUID()
  classId: string;

  @IsOptional()
  @IsUUID()
  meetingId?: string; // Optional - filled in async flow after meeting creation

  @IsNotEmpty()
  @IsEnum(SessionType)
  sessionType: SessionType = SessionType.CLASS_SESSION;

  @IsOptional()
  @IsString()
  serviceType?: string; // Business-level service type

  @IsNotEmpty()
  @IsUUID()
  mentorUserId: string;

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
  @IsEnum(ClassSessionStatus)
  status?: ClassSessionStatus; // Optional, defaults to PENDING_MEETING
}
