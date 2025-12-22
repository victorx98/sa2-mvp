import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ProductNotDraftException (产品不是草稿异常)
 * Thrown when attempting an operation that requires DRAFT status (尝试需要DRAFT状态的操作时抛出)
 */
export class ProductNotDraftException extends DomainException {
  constructor(productId: string) {
    super(
      'PRODUCT_NOT_DRAFT',
      `Product ${productId} is not in DRAFT status and cannot be modified`,
      { productId },
    );
  }
}
