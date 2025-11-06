import { IsOptional, IsEnum, IsString, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import {
  ServiceType,
  BillingMode,
  ServiceStatus,
} from "../../common/interfaces/enums";

export class ServiceFilterDto {
  @IsOptional()
  @IsString()
  keyword?: string; // Keyword search (name, code, description)

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType; // Filter by service type

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
