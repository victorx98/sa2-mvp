import { IsOptional, IsString, IsUUID, IsBoolean } from "class-validator";

export class FindOneProductDto {
  @IsOptional()
  @IsUUID()
  id?: string; // Product ID

  @IsOptional()
  @IsString()
  code?: string; // Product code (unique)

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean; // Whether to include soft-deleted products [是否包含软删除的产品]
}
