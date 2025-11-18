import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  IsEnum,
  Min,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";
import { Currency, MarketingLabel, UserPersona } from "@shared/types/catalog-enums";

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
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

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
  targetUserTypes?: UserPersona[];

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketingLabels?: MarketingLabel[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataDto)
  metadata?: ProductMetadataDto;
}
