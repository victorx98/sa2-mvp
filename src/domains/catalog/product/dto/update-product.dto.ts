import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  IsNumber,
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];
}

class FAQDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

/**
 * Update Product DTO [更新产品数据传输对象]
 * Used for updating product information [用于更新产品信息]
 */
export class UpdateProductDto {
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
  @IsArray()
  @IsEnum(UserPersona, { each: true })
  targetUserPersonas?: UserPersona[];

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketingLabels?: MarketingLabel[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataDto)
  metadata?: ProductMetadataDto;
}
