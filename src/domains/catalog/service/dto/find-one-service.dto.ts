import { IsOptional, IsString, IsUUID } from "class-validator";

export class FindOneServiceDto {
  @IsOptional()
  @IsUUID()
  id?: string; // Service ID

  @IsOptional()
  @IsString()
  code?: string; // Service code (unique)

  // At least one field must be provided
  // If multiple fields are provided, they are combined with AND logic
}
