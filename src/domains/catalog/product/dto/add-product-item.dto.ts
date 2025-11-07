import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsEnum,
  Min,
  IsOptional,
} from "class-validator";
import { ProductItemType } from "../../common/interfaces/enums";

export class AddProductItemDto {
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
