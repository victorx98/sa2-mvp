import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ProductService } from "@domains/catalog/product/services/product.service";
import { CreateProductDto } from "@domains/catalog/product/dto/create-product.dto";
import { IProduct } from "@domains/catalog/product/interfaces/product.interface";

/**
 * Create Product Command (Application Layer)
 * [创建产品命令]
 *
 * 职责：
 * 1. 编排产品创建用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回业务数据
 */
@Injectable()
export class CreateProductCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行创建产品用例
   * [Execute create product use case]
   *
   * @param input 创建产品输入参数
   * @param userId 创建者ID
   * @returns 创建的产品
   */
  async execute(input: CreateProductDto, userId: string): Promise<IProduct> {
    try {
      this.logger.debug(`Creating product: ${input.name}`);
      const product = await this.productService.create(input, userId);
      this.logger.debug(`Product created successfully: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(
        `Failed to create product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
