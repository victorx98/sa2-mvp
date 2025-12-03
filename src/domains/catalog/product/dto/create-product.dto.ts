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
  IsUrl,
} from "class-validator";
import { Type } from "class-transformer";
import {
  Currency,
  MarketingLabel,
  UserPersona,
} from "@shared/types/catalog-enums";

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
  @IsUUID()
  serviceTypeId: string;

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
  @IsEnum(UserPersona, { each: true })
  targetUserPersonas?: UserPersona[];

  // Pricing information
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

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
