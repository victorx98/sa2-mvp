import { DomainException } from '@core/exceptions/domain.exception';

/**
 * DuplicateServiceTypeException (重复服务类型异常)
 * Thrown when trying to add duplicate service type (尝试添加重复服务类型时抛出)
 */
export class DuplicateServiceTypeException extends DomainException {
  constructor(productId: string, serviceTypeId: string) {
    super(
      'DUPLICATE_SERVICE_TYPE',
      `Product ${productId} already has item for service type ${serviceTypeId}`,
      { productId, serviceTypeId },
    );
  }
}
