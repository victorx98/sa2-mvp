/**
 * Class Mentor Price Filter DTO
 *
 * This DTO defines the data structure for filtering class mentor price records
 */

import { IsUUID, IsString, IsOptional } from "class-validator";

export class ClassMentorPriceFilterDto {
  @IsUUID()
  @IsOptional()
  classId?: string; // Class ID

  @IsUUID()
  @IsOptional()
  mentorUserId?: string; // Mentor user ID

  @IsString()
  @IsOptional()
  status?: string; // Status (active, deleted)
}
