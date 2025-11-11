import { IsOptional, IsInt, Min, IsBoolean, IsString } from "class-validator";

/**
 * DTO for updating archive policy (更新归档策略的DTO)
 * Used when updating an archive policy (用于更新归档策略)
 */
export class UpdateArchivePolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  archiveAfterDays?: number; // Days after which to archive (归档后天数)

  @IsOptional()
  @IsBoolean()
  deleteAfterArchive?: boolean; // Whether to delete after archiving (归档后是否删除)

  @IsOptional()
  @IsBoolean()
  enabled?: boolean; // Whether policy is enabled (策略是否启用)

  @IsOptional()
  @IsString()
  notes?: string; // Policy notes (策略备注)
}
