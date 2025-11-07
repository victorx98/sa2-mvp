import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

class ServicePackageMetadataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

class ServicePackageItemDto {
  @IsNotEmpty()
  @IsUUID()
  serviceId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateServicePackageDto {
  // Service package identifier
  @IsNotEmpty()
  @IsString()
  code: string; // Service package code, e.g. 'basic_package'

  @IsNotEmpty()
  @IsString()
  name: string; // Service package name, e.g. 'Job Search Basics'

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  // Metadata
  @IsOptional()
  @ValidateNested()
  @Type(() => ServicePackageMetadataDto)
  metadata?: ServicePackageMetadataDto;

  // Service items (optional, can be added via addService after creation)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicePackageItemDto)
  items?: ServicePackageItemDto[];
}
