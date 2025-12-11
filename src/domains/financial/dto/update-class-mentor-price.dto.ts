/**
 * Update Class Mentor Price DTO
 *
 * This DTO defines the data structure for updating class mentor price records
 */

import { IsNumber, IsPositive, IsOptional } from "class-validator";

export class UpdateClassMentorPriceDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  pricePerSession?: number; // Price per session
}
