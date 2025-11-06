import { IsOptional, IsString, IsUUID } from "class-validator";

export class FindOneServicePackageDto {
  @IsOptional()
  @IsUUID()
  id?: string; // Service package ID

  @IsOptional()
  @IsString()
  code?: string; // Service package code (unique)

  // At least one field must be provided
  // If multiple fields are provided, they are combined with AND logic
}
