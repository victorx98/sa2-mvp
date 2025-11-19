import { IsOptional, IsString, IsUUID } from "class-validator";

export class FindOneProductDto {
  @IsOptional()
  @IsUUID()
  id?: string; // Product ID

  @IsOptional()
  @IsString()
  code?: string; // Product code (unique)
}
