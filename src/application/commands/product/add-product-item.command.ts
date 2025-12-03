import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { AddProductItemDto } from '@domains/catalog';

/**
 * Add Product Item Command (Application Layer)
 * [向产品添加项目命令]
 * 
 * 职责：
 * 1. 编排向产品添加项目用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回执行结果
 */
@Injectable()
export class AddProductItemCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行向产品添加项目用例
   * [Execute add product item use case]
   * 
   * @param productId - 产品ID
   * @param item - 项目数据
   * @returns 执行结果
   */
  async execute(productId: string, item: AddProductItemDto) {
    return this.productService.addItem(productId, item);
  }
}
 
   * @param productId 产品ID
   * @param dto 添加产品项目DTO
   * @returns 执行结果
   */
  async execute(productId: string, dto: AddProductItemDto): Promise<void> {
    try {
      this.logger.debug(`Adding item to product: ${productId}`);
      await this.productService.addItem(productId, dto);
      this.logger.debug(`Item added to product successfully: ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to add item to product: ${error.message}`, error.stack);
      throw error;
    }
  }
}