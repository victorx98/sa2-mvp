import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class ItemSortOrderDto {
  @IsNotEmpty()
  @IsUUID()
  itemId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class UpdateItemSortOrderDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSortOrderDto)
  items: ItemSortOrderDto[];
}
