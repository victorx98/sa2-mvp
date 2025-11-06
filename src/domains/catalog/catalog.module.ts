import { Module } from "@nestjs/common";
import { ServiceModule } from "./service/service.module";
import { ServicePackageModule } from "./service-package/service-package.module";
import { ProductModule } from "./product/product.module";

@Module({
  imports: [ServiceModule, ServicePackageModule, ProductModule],
  exports: [ServiceModule, ServicePackageModule, ProductModule],
})
export class CatalogModule {}
