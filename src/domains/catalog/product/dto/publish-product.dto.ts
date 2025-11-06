import { IsOptional, IsDateString } from "class-validator";

export class PublishProductDto {
  @IsOptional()
  @IsDateString()
  publishAt?: string; // Scheduled publish time (memo only, not auto-triggered)
}
