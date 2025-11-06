import { IsOptional, IsString, IsUUID } from "class-validator";

export class FindOneProductDto {
  @IsOptional()
  @IsUUID()
  id?: string; // Product ID

  @IsOptional()
  @IsString()
  code?: string; // Product code (unique)

  // At least one field must be provided
  // If multiple fields are provided, they are combined with AND logic
}
