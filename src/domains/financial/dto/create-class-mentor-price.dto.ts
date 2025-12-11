/**
 * Create Class Mentor Price DTO
 *
 * This DTO defines the data structure for creating class mentor price records
 */

import { IsUUID, IsNumber, IsPositive } from "class-validator";

export class CreateClassMentorPriceDto {
  @IsUUID()
  classId: string; // Class ID

  @IsUUID()
  mentorUserId: string; // Mentor user ID

  @IsNumber()
  @IsPositive()
  pricePerSession: number; // Price per session
}
