import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  ServiceType,
  BillingMode,
} from "../../common/interfaces/enums";

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

export class CreateServiceDto {
  // Service identifier
  @IsNotEmpty()
  @IsString()
  code: string; // Service code, e.g. 'resume_review'

  @IsNotEmpty()
  @IsEnum(ServiceType)
  serviceType: ServiceType; // Service type

  // Basic information
  @IsNotEmpty()
  @IsString()
  name: string; // Service name, e.g. 'Resume Review'

  @IsOptional()
  @IsString()
  description?: string; // Service description

  @IsOptional()
  @IsString()
  coverImage?: string; // Cover image URL

  // Billing configuration
  @IsNotEmpty()
  @IsEnum(BillingMode)
  billingMode: BillingMode; // Billing mode

  // Service configuration
  @IsOptional()
  @IsBoolean()
  requiresEvaluation?: boolean; // Whether evaluation is required before billing

  @IsOptional()
  @IsBoolean()
  requiresMentorAssignment?: boolean; // Whether mentor assignment is required

  // Metadata
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceMetadataDto)
  metadata?: ServiceMetadataDto;
}
