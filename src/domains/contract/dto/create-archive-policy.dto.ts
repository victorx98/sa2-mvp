import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsString,
  IsInt,
  Min,
  IsBoolean,
} from "class-validator";

/**
 * DTO for creating archive policy (创建归档策略的DTO)
 * Used when creating an archive policy (用于创建归档策略)
 */
export class CreateArchivePolicyDto {
  @IsNotEmpty()
  @IsEnum(["global", "contract", "service_type"])
  scope: "global" | "contract" | "service_type"; // Policy scope (策略范围)

  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (合约ID)

  @IsOptional()
  @IsString()
  serviceType?: string; // Service type (服务类型)

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  archiveAfterDays: number; // Days after which to archive (归档后天数)

  @IsNotEmpty()
  @IsBoolean()
  deleteAfterArchive: boolean; // Whether to delete after archiving (归档后是否删除)

  @IsNotEmpty()
  @IsString()
  createdBy: string; // ID of creator (创建人ID)

  @IsOptional()
  @IsString()
  notes?: string; // Policy notes (策略备注)
}
