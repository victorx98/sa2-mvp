import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { BillingMode, ServiceUnit } from "../../common/interfaces/enums";

class ServiceMetadataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];
}

export class UpdateServiceDto {
  // Basic information (optional update)
  @IsOptional()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  // Billing configuration (optional update)
  @IsOptional()
  @IsEnum(BillingMode)
  billingMode?: BillingMode;

  @IsOptional()
  @IsEnum(ServiceUnit)
  defaultUnit?: ServiceUnit;

  // Service configuration (optional update)
  @IsOptional()
  @IsBoolean()
  requiresEvaluation?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresMentorAssignment?: boolean;

  // Metadata (optional update)
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceMetadataDto)
  metadata?: ServiceMetadataDto;
}
