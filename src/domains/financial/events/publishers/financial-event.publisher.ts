/**
 * Financial Domain Event Publisher(金融领域事件发布者)
 *
 * 基于 NestJS EventEmitter2 实现的标准化事件发布服务
 * Implements standardized event publishing service based on NestJS EventEmitter2
 */

import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { validate } from "class-validator";
import type { IFinancialEvent } from "../types/financial-event.types";
import { FinancialEventValidationException } from "../exceptions/financial-event-validation.exception";

/**
 * 金融领域事件发布服务
 * Financial Domain Event Publisher Service
 */
@Injectable()
export class FinancialEventPublisher {
  private readonly logger = new Logger(FinancialEventPublisher.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 发布金融领域事件
   * Publish financial domain event
   * @param event 要发布的事件
   * @throws {FinancialEventValidationException} 当事件验证失败时
   */
  public async publishEvent<T extends IFinancialEvent>(
    event: T,
  ): Promise<void> {
    try {
      this.logger.log(
        `Publishing financial event: ${event.eventType} with ID: ${event.eventId}`,
      );

      // 验证事件数据
      await this.validateEvent(event);

      // 发布事件到 EventEmitter2
      this.eventEmitter.emit(event.eventType, event);

      this.logger.log(
        `Successfully published financial event: ${event.eventType} with ID: ${event.eventId}`,
      );
    } catch (error) {
      if (error instanceof FinancialEventValidationException) {
        this.logger.error(
          `Event validation failed for ${event.eventType}: ${error.message}`,
        );
        throw error;
      }

      this.logger.error(
        `Failed to publish financial event: ${event.eventType} with ID: ${event.eventId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Failed to publish financial event: ${event.eventType}`);
    }
  }

  /**
   * 批量发布金融领域事件
   * Publish multiple financial domain events
   * @param events 要发布的事件数组
   */
  public async publishEvents<T extends IFinancialEvent>(
    events: T[],
  ): Promise<void> {
    try {
      this.logger.log(`Publishing batch of ${events.length} financial events`);

      // 并发发布所有事件
      const publishPromises = events.map((event) => this.publishEvent(event));
      await Promise.all(publishPromises);

      this.logger.log(
        `Successfully published batch of ${events.length} financial events`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish batch of financial events`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error("Failed to publish batch of financial events");
    }
  }

  /**
   * 验证事件数据
   * Validate event data
   * @param event 要验证的事件
   * @throws {FinancialEventValidationException} 当验证失败时
   */
  private async validateEvent<T extends IFinancialEvent>(
    event: T,
  ): Promise<void> {
    try {
      // 使用 class-validator 验证事件
      const errors = await validate(event as any);

      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");

        throw new FinancialEventValidationException(
          `Event validation failed for ${event.eventType}: ${errorMessages}`,
          errors,
        );
      }
    } catch (error) {
      if (error instanceof FinancialEventValidationException) {
        throw error;
      }

      this.logger.error(`Unexpected error during event validation: ${error}`);
      throw new FinancialEventValidationException(
        `Unexpected validation error for ${event.eventType}`,
        [],
      );
    }
  }

  /**
   * 获取事件发布统计信息
   * Get event publishing statistics
   * @returns 统计信息
   */
  public getEventStats(): { listenerCount: number; eventNames: string[] } {
    // EventEmitter2 提供了获取监听器信息的方法
    const listenerCount = this.eventEmitter.listenerCount();
    const eventNames = this.eventEmitter.eventNames();

    return {
      listenerCount,
      eventNames: eventNames.map((name) => name.toString()),
    };
  }
}
