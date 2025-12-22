import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ProductMinItemsException (产品项数量不足异常)
 * Thrown when attempting to publish product with no items (尝试发布没有items的产品时抛出)
 */
export class ProductMinItemsException extends DomainException {
  constructor(productId: string) {
    super(
      'PRODUCT_MIN_ITEMS',
      `Product ${productId} must have at least one item`,
      { productId },
    );
  }
}
