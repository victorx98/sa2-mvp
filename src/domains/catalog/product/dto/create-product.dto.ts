import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  IsEnum,
  Min,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";
import {
  Currency,
  UserType,
  MarketingLabel,
  ProductItemType,
} from "../../common/interfaces/enums";

class ProductMetadataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FAQDto)
  faqs?: FAQDto[];
}

class FAQDto {
  @IsNotEmpty()
  @IsString()
  question: string;

  @IsNotEmpty()
  @IsString()
  answer: string;
}

class ProductItemDto {
  @IsNotEmpty()
  @IsEnum(ProductItemType)
  type: ProductItemType;

  @IsNotEmpty()
  @IsUUID()
  referenceId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateProductDto {
  // Basic information
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  // Target users
  @IsOptional()
  @IsArray()
  @IsEnum(UserType, { each: true })
  targetUserTypes?: UserType[];

  // Pricing information
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  // Marketing labels
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketingLabels?: MarketingLabel[];

  // Metadata
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataDto)
  metadata?: ProductMetadataDto;

  // Product items (optional)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductItemDto)
  items?: ProductItemDto[];
}
