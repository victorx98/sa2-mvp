import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ProductSortOrderDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class UpdateProductSortOrderDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSortOrderDto)
  products: ProductSortOrderDto[];
}
