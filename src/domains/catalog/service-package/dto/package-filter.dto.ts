import { IsOptional, IsString, IsBoolean, IsIn, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { ServiceStatus } from "@shared/types/catalog-enums";

export class PackageFilterDto {
  @IsOptional()
  @IsString()
  keyword?: string; // Keyword search (name, code, description)

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus; // Filter by status

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false; // Whether to include deleted packages (default: false)
}
