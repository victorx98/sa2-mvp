import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ProductService } from "./services/product.service";

@Module({
  imports: [DatabaseModule],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
