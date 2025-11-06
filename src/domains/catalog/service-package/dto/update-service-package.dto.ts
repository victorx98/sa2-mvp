import { IsString, IsOptional, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class ServicePackageMetadataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

export class UpdateServicePackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServicePackageMetadataDto)
  metadata?: ServicePackageMetadataDto;
}
