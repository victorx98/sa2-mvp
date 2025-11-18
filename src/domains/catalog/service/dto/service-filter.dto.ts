import { IsOptional, IsString, IsBoolean, IsIn, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { BillingMode, ServiceStatus } from "@shared/types/catalog-enums";

export class ServiceFilterDto {
  @IsOptional()
  @IsString()
  keyword?: string; // Keyword search (name, code, description)

  @IsOptional()
  @IsString()
  serviceType?: string; // Filter by service type (references service_types.code)

  @IsOptional()
  @IsEnum(BillingMode)
  billingMode?: BillingMode; // Filter by billing mode

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus; // Filter by status

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false; // Whether to include deleted services (default: false)
}
