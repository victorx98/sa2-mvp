import {
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
  IsUUID,
} from "class-validator";
import { SessionStatus } from "../interfaces/session.interface";

export class UpdateSessionDto {
  @IsOptional()
  @IsDateString()
  scheduledStartTime?: string; // Modify start time

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  scheduledDuration?: number; // Modify planned duration (30-180 minutes)

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sessionName?: string; // Modify session name

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Modify notes

  @IsOptional()
  @IsUUID()
  contractId?: string; // Modify associated contract ID (for wrong product selection)

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus; // Modify status (limited state transitions)
}
