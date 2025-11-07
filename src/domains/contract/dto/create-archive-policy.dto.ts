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
 * Create Archive Policy DTO
 * Used when creating an archive policy
 */
export class CreateArchivePolicyDto {
  @IsNotEmpty()
  @IsEnum(["global", "contract", "service_type"])
  scope: "global" | "contract" | "service_type";

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  archiveAfterDays: number;

  @IsNotEmpty()
  @IsBoolean()
  deleteAfterArchive: boolean;

  @IsNotEmpty()
  @IsString()
  createdBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
