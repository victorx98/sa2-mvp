/**
 * Product Mapper (产品映射器)
 * Converts between domain entities and database records (在领域实体和数据库记录之间转换)
 */

import { Product, ProductItem } from '../../entities';
import { Price, ProductCode, ProductStatus } from '../../value-objects';
import type { Product as ProductRecord } from '@infrastructure/database/schema/products.schema';
import type { ProductItem as ProductItemRecord } from '@infrastructure/database/schema/product-items.schema';

export class ProductMapper {
  /**
   * Convert database records to domain entity (将数据库记录转换为领域实体)
   *
   * @param record - Product database record (产品数据库记录)
   * @param itemRecords - Array of product item records (产品项记录数组)
   * @returns Product domain entity (产品领域实体)
   */
  toDomain(
    record: ProductRecord,
    itemRecords: ProductItemRecord[],
  ): Product {
    // Create value objects (创建值对象)
    const code = ProductCode.reconstruct(record.code);
    const price = Price.create(record.price, record.currency as any);
    const status = ProductStatus.reconstruct(record.status);

    // Convert item records to domain entities (将item记录转换为领域实体)
    const items = itemRecords.map(itemRecord => this.itemToDomain(itemRecord));

    // Reconstruct the Product entity (重建Product实体)
    return Product.reconstruct({
      id: record.id,
      name: record.name,
      code,
      description: record.description ?? undefined,
      price,
      currency: record.currency,
      coverImage: record.coverImage ?? undefined,
      targetUserPersona: record.targetUserPersona ?? undefined,
      marketingLabels: record.marketingLabels ?? undefined,
      status,
      items,
      metadata: record.metadata ?? undefined,
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? '',
      updatedAt: record.updatedAt ?? undefined,
      updatedBy: record.updatedBy ?? undefined,
      publishedAt: record.publishedAt ?? undefined,
      unpublishedAt: record.unpublishedAt ?? undefined,
    });
  }

  /**
   * Convert domain entity to database records (将领域实体转换为数据库记录)
   *
   * @param product - Product domain entity (产品领域实体)
   * @returns Object containing product and item records (包含产品和item记录的对象)
   */
  toPersistence(product: Product): {
    product: ProductRecord;
    items: ProductItemRecord[];
  } {
    // Convert product entity to record (将产品实体转换为记录)
    const productRecord: ProductRecord = {
      id: product.getId(),
      name: product.getName(),
      code: product.getCode().getValue(),
      price: product.getPrice().getAmount(),
      currency: product.getPrice().getCurrency(),
      description: product.getDescription() ?? null,
      coverImage: product.getCoverImage() ?? null,
      targetUserPersona: product.getTargetUserPersona() ?? null,
      marketingLabels: product.getMarketingLabels() ?? null,
      status: product.getStatus().getValue(),
      publishedAt: product.getPublishedAt() ?? null,
      unpublishedAt: product.getUnpublishedAt() ?? null,
      metadata: product.getMetadata() ?? null,
      createdBy: product.getCreatedBy(),
      updatedBy: product.getUpdatedBy() ?? null,
      createdAt: product.getCreatedAt(),
      updatedAt: product.getUpdatedAt() ?? null,
      deletedAt: null,
    };

    // Convert item entities to records (将item实体转换为记录)
    const itemRecords = product.getItems().map(item => this.itemToPersistence(item));

    return {
      product: productRecord,
      items: itemRecords,
    };
  }

  /**
   * Convert product item record to domain entity (将产品项记录转换为领域实体)
   *
   * @param record - Product item database record (产品项数据库记录)
   * @returns ProductItem domain entity (产品项领域实体)
   */
  private itemToDomain(
    record: ProductItemRecord,
  ): ProductItem {
    return ProductItem.reconstruct({
      id: record.id,
      productId: record.productId,
      serviceTypeId: record.serviceTypeId,
      quantity: record.quantity,
      sortOrder: record.sortOrder,
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? undefined,
      updatedAt: record.updatedAt ?? undefined,
      updatedBy: record.updatedBy ?? undefined,
    });
  }

  /**
   * Convert product item entity to database record (将产品项实体转换为数据库记录)
   *
   * @param item - ProductItem domain entity (产品项领域实体)
   * @returns ProductItem database record (产品项数据库记录)
   */
  private itemToPersistence(
    item: ProductItem,
  ): ProductItemRecord {
    return {
      id: item.getId(),
      productId: item.getProductId(),
      serviceTypeId: item.getServiceTypeId(),
      quantity: item.getQuantity(),
      sortOrder: item.getSortOrder(),
      createdAt: item.getCreatedAt(),
      createdBy: item.getCreatedBy() ?? null,
      updatedAt: item.getUpdatedAt() ?? null,
      updatedBy: item.getUpdatedBy() ?? null,
    };
  }
}
