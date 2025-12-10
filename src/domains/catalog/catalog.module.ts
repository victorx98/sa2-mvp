import { Module } from "@nestjs/common";
import { ProductModule } from "./product/product.module";
import { ServiceTypeModule } from "./service-type/service-type.module";

@Module({
  imports: [ProductModule, ServiceTypeModule],
  exports: [ProductModule, ServiceTypeModule],
})
export class CatalogModule {}
