import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { ProductMapper } from "./infrastructure/mappers/product.mapper";
import { DrizzleProductRepository } from "./infrastructure/repositories/drizzle-product.repository";
import { PRODUCT_REPOSITORY } from "./repositories/product.repository.interface";

@Module({
  imports: [DatabaseModule],
  providers: [
    // Infrastructure
    ProductMapper,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: DrizzleProductRepository,
    },
  ],
  exports: [
    PRODUCT_REPOSITORY,
  ],
})
export class ProductModule {}
