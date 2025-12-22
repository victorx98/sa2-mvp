import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ProductItemNotFoundException (产品项未找到异常)
 * Thrown when trying to remove a non-existent item (尝试移除不存在的item时抛出)
 */
export class ProductItemNotFoundException extends DomainException {
  constructor(productId: string, itemId: string) {
    super(
      'PRODUCT_ITEM_NOT_FOUND',
      `Item ${itemId} not found in product ${productId}`,
      { productId, itemId },
    );
  }
}
