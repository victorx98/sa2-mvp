import { IsOptional, IsEnum, IsString, IsBoolean, IsIn } from "class-validator";
import { Type, Transform } from "class-transformer";
import {
  MarketingLabel,
  ProductStatus,
  UserPersona,
} from "@shared/types/catalog-enums";

export class ProductFilterDto {
  @IsOptional()
  @IsString()
  name?: string; // Name fuzzy search

  @IsOptional()
  @IsString()
  code?: string; // Code fuzzy search

  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value), {
    toClassOnly: true,
  })
  @IsEnum(ProductStatus)
  status?: ProductStatus; // Filter by status

  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsEnum(UserPersona)
  userPersona?: UserPersona; // Filter by target user persona

  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsString()
  @IsIn(["hot", "new", "recommended"])
  marketingLabel?: MarketingLabel; // Filter by marketing label

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false; // Whether to include deleted products (default: false)
}
