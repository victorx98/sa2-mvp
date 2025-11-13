/**
 * Financial Event Validation Exception(金融领域事件验证异常)
 *
 * 金融领域事件验证失败时抛出的异常
 */

import { ValidationError } from "class-validator";

/**
 * 金融领域事件验证异常
 * Financial Domain Event Validation Exception
 */
export class FinancialEventValidationException extends Error {
  constructor(
    message: string,
    public readonly validationErrors: ValidationError[],
  ) {
    super(message);
    this.name = "FinancialEventValidationException";
  }
}
