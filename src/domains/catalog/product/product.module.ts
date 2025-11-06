import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ServiceModule } from "../service/service.module";
import { ServicePackageModule } from "../service-package/service-package.module";
import { ProductService } from "./services/product.service";

@Module({
  imports: [DatabaseModule, ServiceModule, ServicePackageModule],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
