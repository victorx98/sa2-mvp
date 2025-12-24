import { Injectable, Logger } from "@nestjs/common";

/**
 * Event Listener Base Class for Contract Domain [Contract Domain的事件监听器基类]
 *
 * 提供通用的事件处理和验证功能
 * Provides common event handling and validation functionality
 */
@Injectable()
export abstract class ContractEventListenerBase {
  protected readonly logger: Logger;

  /**
   * Constructor
   *
   * @param loggerContext Logger context name [日志上下文名称]
   */
  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Validate event payload has required fields [验证事件负载包含必填字段]
   *
   * @param event Event object [事件对象]
   * @param requiredFields Array of required field names [必填字段名数组]
   * @returns true if all required fields exist, false otherwise [如果所有必填字段都存在则返回true，否则返回false]
   */
  protected validateEventPayload(
    event: any,
    requiredFields: string[],
  ): boolean {
    const missingFields = requiredFields.filter(
      (field) => !event.payload?.[field],
    );

    if (missingFields.length > 0) {
      const fieldInfo = missingFields
        .map((field) => `${field}=${event.payload?.[field]}`)
        .join(", ");
      this.logger.error(
        `Missing required fields in event payload: ${fieldInfo}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Validate quantity is positive [验证数量为正数]
   *
   * @param quantity Quantity to validate [要验证的数量]
   * @param fieldName Field name for logging [用于日志的字段名]
   * @returns true if quantity is positive, false otherwise [如果数量为正数则返回true，否则返回false]
   */
  protected validatePositiveQuantity(
    quantity: number,
    fieldName: string = "quantity",
  ): boolean {
    if (quantity <= 0) {
      this.logger.warn(
        `Invalid ${fieldName}: ${quantity}. Must be positive.`,
      );
      return false;
    }
    return true;
  }

  /**
   * Handle and log event processing error [处理并记录事件处理错误]
   *
   * @param error Error object [错误对象]
   * @param eventDescription Event description for logging [用于日志的事件描述]
   */
  protected handleEventError(
    error: unknown,
    eventDescription: string,
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(
      `Failed to process ${eventDescription}: ${errorMessage}`,
      errorStack,
    );
  }

  /**
   * Extract event payload fields with defaults [提取事件负载字段并设置默认值]
   *
   * @param event Event object [事件对象]
   * @param fieldNames Array of field names to extract [要提取的字段名数组]
   * @param defaults Default values object [默认值对象]
   * @returns Object with extracted fields [包含提取字段的对象]
   */
  protected extractPayloadFields<T extends Record<string, any>>(
    event: any,
    fieldNames: string[],
    defaults: Partial<T> = {},
  ): T {
    const result: Partial<T> = {};

    fieldNames.forEach((fieldName) => {
      result[fieldName as keyof T] =
        event.payload?.[fieldName] ?? defaults[fieldName];
    });

    return result as T;
  }
}
