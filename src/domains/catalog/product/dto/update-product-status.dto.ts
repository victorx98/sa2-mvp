import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ProductStatus } from "@shared/types/catalog-enums";

export class UpdateProductStatusDto {
  @ApiProperty({
    enum: ProductStatus,
    description: "Target status for the product",
    example: ProductStatus.ACTIVE,
  })
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
