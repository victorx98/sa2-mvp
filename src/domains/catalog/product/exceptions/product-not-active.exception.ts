import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ProductNotActiveException (产品不是激活状态异常)
 * Thrown when attempting to unpublish a non-active product (尝试下架非激活状态产品时抛出)
 */
export class ProductNotActiveException extends DomainException {
  constructor(productId: string, status: string) {
    super(
      'PRODUCT_NOT_ACTIVE',
      `Product ${productId} is in ${status} status and cannot be unpublished`,
      { productId, status },
    );
  }
}
