import { IsOptional, IsEnum, IsString, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import {
  ProductStatus,
  UserType,
  MarketingLabel,
} from "../../common/interfaces/enums";

export class ProductFilterDto {
  @IsOptional()
  @IsString()
  keyword?: string; // Keyword search (name, code, description)

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus; // Filter by status

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType; // Filter by education level

  @IsOptional()
  @IsString()
  marketingLabel?: MarketingLabel; // Filter by marketing label

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false; // Whether to include deleted products (default: false)
}
