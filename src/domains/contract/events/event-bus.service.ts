import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter } from "events";
import type { DomainEvent } from "@infrastructure/database/schema";
import type { IDomainEventData } from "../common/types/event.types";

/**
 * Event Bus Service (本地事件总线)
 * - 使用 Node.js EventEmitter 实现
 * - 用于 Contract Domain 内部事件通信
 * - 后续可替换为 RabbitMQ/Kafka 等分布式消息队列
 *
 * 实现特点：
 * - 同步事件分发
 * - 内存存储 (无持久化)
 * - 单进程内工作
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly emitter = new EventEmitter();

  /**
   * 发布事件到本地总线
   * @param event 领域事件
   */
  publish(event: DomainEvent): void {
    this.logger.log(`[EventBus] Publishing: ${event.eventType}`);
    this.emitter.emit(event.eventType, event);
  }

  /**
   * 订阅事件类型
   * @param eventType 事件类型 (如: "payment.succeeded")
   * @param handler 事件处理函数
   */
  subscribe(
    eventType: string,
    handler: (event: IDomainEventData) => void,
  ): void {
    this.logger.log(`[EventBus] Subscribing to: ${eventType}`);
    this.emitter.on(eventType, handler);
  }

  /**
   * 取消订阅
   * @param eventType 事件类型
   * @param handler 事件处理函数
   */
  unsubscribe(
    eventType: string,
    handler: (event: IDomainEventData) => void,
  ): void {
    this.logger.log(`[EventBus] Unsubscribing from: ${eventType}`);
    this.emitter.off(eventType, handler);
  }

  /**
   * 获取活跃监听器数量 (调试用)
   * @param eventType 事件类型
   */
  listenerCount(eventType: string): number {
    return this.emitter.listenerCount(eventType);
  }
}
