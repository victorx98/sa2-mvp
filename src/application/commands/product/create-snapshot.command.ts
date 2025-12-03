import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommandBase } from '@application/core/command.base';
import { ProductService } from '@domains/catalog/product/services/product.service';
import { IProductSnapshot } from '@domains/catalog/product/interfaces/product-snapshot.interface';

/**
 * Create Product Snapshot Command (Application Layer)
 * [创建产品快照命令]
 * 
 * 职责：
 * 1. 编排创建产品快照用例
 * 2. 调用 Catalog Domain 的 Product Service
 * 3. 返回创建的产品快照
 */
@Injectable()
export class CreateProductSnapshotCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  /**
   * 执行创建产品快照用例
   * [Execute create product snapshot use case]
   * 
   * @param productId 产品ID
   * @returns 创建的产品快照
   */
  async execute(productId: string): Promise<IProductSnapshot> {
    try {
      this.logger.debug(`Creating snapshot for product: ${productId}`);
      const snapshot = await this.productService.createSnapshot(productId);
      this.logger.debug(`Product snapshot created successfully: ${productId}`);
      return snapshot;
    } catch (error) {
      this.logger.error(`Failed to create product snapshot: ${error.message}`, error.stack);
      throw error;
    }
  }
}