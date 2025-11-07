import { IsOptional, IsInt, Min, IsBoolean, IsString } from "class-validator";

/**
 * Update Archive Policy DTO
 * Used when updating an archive policy
 */
export class UpdateArchivePolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  archiveAfterDays?: number;

  @IsOptional()
  @IsBoolean()
  deleteAfterArchive?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
