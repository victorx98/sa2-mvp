import { Module } from "@nestjs/common";
import { ProductModule } from "./product/product.module";

@Module({
  imports: [ProductModule],
  exports: [ProductModule],
})
export class CatalogModule {}
