import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import {
  Currency,
  MarketingLabel,
  UserPersona,
} from "@shared/types/catalog-enums";
import { AddProductItemDto } from "./add-product-item.dto";

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

class ProductItemSortDto {
  @IsNotEmpty()
  @IsUUID()
  itemId: string;
  
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

/**
 * Update Product DTO [更新产品数据传输对象]
 * Used for updating product information and product items [用于更新产品信息和产品项]
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

  // Product item operations [产品项操作]
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddProductItemDto)
  addItems?: AddProductItemDto[]; // Add product items [添加产品项]

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  removeItems?: string[]; // Remove product items by ID [通过ID删除产品项]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductItemSortDto)
  sortItems?: ProductItemSortDto[]; // Update product item sort order [更新产品项排序]
}

export { ProductItemSortDto };
