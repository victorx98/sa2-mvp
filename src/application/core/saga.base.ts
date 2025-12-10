import { Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type {
  DrizzleDatabase
} from '@shared/types/database.types';
import { CommandBase } from './command.base';

/**
 * Saga Base Class
 * [Saga基类]
 * 
 * 提供复杂跨域操作的基础功能，包括：
 * 1. 事务管理（继承自CommandBase）
 * 2. 日志记录（继承自CommandBase）
 * 3. 错误处理（继承自CommandBase）
 * 4. 事件发布
 * 5. 多步骤操作协调
 * 
 * Usage:
 * ```typescript
 * @Injectable()
export class BookSessionSaga extends SagaBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    eventEmitter: EventEmitter2,
    private readonly sessionService: SessionService,
    private readonly holdService: ServiceHoldService,
  ) {
    super(db, eventEmitter);
  }

  async execute(input: BookSessionInput): Promise<BookSessionOutput> {
    return this.withTransaction(async (tx) => {
      // 业务逻辑
      const hold = await this.holdService.createHold(input, tx);
      const session = await this.sessionService.createSession(input, tx);
      
      // 发布事件
      this.emitEvent(SESSION_BOOKED_EVENT, { sessionId: session.id, holdId: hold.id });
      
      return { session, hold };
    });
  }
}
 * ```
 */
export abstract class SagaBase extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    protected readonly eventEmitter: EventEmitter2,
  ) {
    super(db);
  }

  /**
   * 发布事件
   * [Publish event]
   * 
   * @param eventName 事件名称
   * @param payload 事件 payload
   */
  protected emitEvent<T>(eventName: string, payload: T): void {
    this.logger.debug(`Emitting event: ${eventName}`);
    this.eventEmitter.emit(eventName, payload);
  }

  /**
   * 协调多步骤操作
   * [Coordinate multi-step operations]
   * 
   * @param steps 步骤列表
   * @returns 执行结果
   */
  protected async coordinateSteps<T>(
    steps: Array<() => Promise<any>>,
  ): Promise<T> {
    this.logger.debug(`Coordinating ${steps.length} steps`);
    
    let result: any;
    for (const [index, step] of steps.entries()) {
      this.logger.debug(`Executing step ${index + 1}/${steps.length}`);
      result = await step();
    }
    
    this.logger.debug('All steps completed successfully');
    return result as T;
  }
}
