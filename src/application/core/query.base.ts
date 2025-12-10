import { Logger } from '@nestjs/common';

/**
 * Query Base Class
 * [查询基类]
 * 
 * 提供查询执行的基础功能，包括：
 * 1. 日志记录
 * 2. 错误处理
 * 
 * Usage:
 * ```typescript
 * @Injectable()
export class GetProductQuery extends QueryBase {
  constructor(
    private readonly productService: ProductService,
  ) {
    super();
  }

  async execute(input: GetProductInput): Promise<GetProductOutput> {
    return this.withErrorHandling(async () => {
      // 业务逻辑
      const product = await this.productService.findOne(input);
      return product;
    });
  }
}
 * ```
 */
export abstract class QueryBase {
  protected readonly logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * 带错误处理的查询执行
   * [Execute query with error handling]
   * 
   * @param callback 查询回调函数
   * @returns 执行结果
   */
  protected async withErrorHandling<T>(
    callback: () => Promise<T>,
  ): Promise<T> {
    try {
      this.logger.debug('Executing query');
      const result = await callback();
      this.logger.debug('Query executed successfully');
      return result;
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
