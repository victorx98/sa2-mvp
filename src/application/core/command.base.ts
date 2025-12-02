import { Inject, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from '@shared/types/database.types';

/**
 * Command Base Class
 * [命令基类]
 * 
 * 提供命令执行的基础功能，包括：
 * 1. 日志记录
 * 2. 事务管理
 * 3. 错误处理
 * 
 * Usage:
 * ```typescript
 * @Injectable()
export class CreateProductCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly productService: ProductService,
  ) {
    super(db);
  }

  async execute(input: CreateProductInput): Promise<CreateProductOutput> {
    return this.withTransaction(async (tx) => {
      // 业务逻辑
      const product = await this.productService.create(input, tx);
      return product;
    });
  }
}
 * ```
 */
export abstract class CommandBase {
  protected readonly logger: Logger;

  constructor(
    @Inject(DATABASE_CONNECTION)
    protected readonly db: DrizzleDatabase,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * 在事务中执行命令
   * [Execute command in transaction]
   * 
   * @param callback 事务回调函数
   * @returns 执行结果
   */
  protected async withTransaction<T>(
    callback: (tx: DrizzleTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      this.logger.debug('Starting transaction');
      const result = await this.db.transaction(callback);
      this.logger.debug('Transaction committed successfully');
      return result;
    } catch (error) {
      this.logger.error(`Transaction rollback: ${error.message}`, error.stack);
      throw error;
    }
  }
}
