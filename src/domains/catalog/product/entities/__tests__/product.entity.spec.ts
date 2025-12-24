import { describe, it, expect, beforeEach } from '@jest/globals';
import { Product } from '../product.entity';
import { ProductItem } from '../product-item.entity';
import { Price, Currency, ProductStatus, ProductCode } from '../../value-objects';
import {
  ProductNotDraftException,
  ProductMinItemsException,
  ProductNotActiveException,
  DuplicateServiceTypeException,
  ProductItemNotFoundException,
} from '../../exceptions';

describe('Product Entity', () => {
  describe('createDraft', () => {
    it('should create a draft product with required fields', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        Price.create(100, Currency.CNY),
        'user-123',
        'Test description'
      );

      expect(product.getId()).toBe('product-123');
      expect(product.getName()).toBe('Test Product');
      expect(product.getCode().getValue()).toBe('TEST-001');
      expect(product.getPrice().getAmount()).toBe('100.00');
      expect(product.getDescription()).toBe('Test description');
      expect(product.getStatus().isDraft()).toBe(true);
      expect(product.getItems()).toHaveLength(0);
      expect(product.getCreatedBy()).toBe('user-123');
    });

    it('should accept string code and number price', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(product.getCode().getValue()).toBe('TEST-001');
      expect(product.getPrice().getAmount()).toBe('100.00');
    });

    it('should accept ProductCode and Price objects', () => {
      const code = ProductCode.create('TEST-001');
      const price = Price.create(100, Currency.CNY);

      const product = Product.createDraft(
        'product-123',
        'Test Product',
        code,
        price,
        'user-123'
      );

      expect(product.getCode()).toBe(code);
      expect(product.getPrice()).toBe(price);
    });
  });

  describe('publish', () => {
    it('should publish a draft product with items', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      // Add an item
      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      // Publish
      product.publish();

      expect(product.getStatus().isActive()).toBe(true);
      expect(product.getPublishedAt()).toBeDefined();
    });

    it('should throw ProductNotDraftException if product is already published', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      product.publish();

      expect(() => product.publish()).toThrow(ProductNotDraftException);
    });

    it('should throw ProductMinItemsException if product has no items', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(() => product.publish()).toThrow(ProductMinItemsException);
    });
  });

  describe('unpublish', () => {
    it('should unpublish an active product', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);
      product.publish();

      product.unpublish();

      expect(product.getStatus().isInactive()).toBe(true);
      expect(product.getUnpublishedAt()).toBeDefined();
    });

    it('should throw ProductNotActiveException if product is not active', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(() => product.unpublish()).toThrow(ProductNotActiveException);
    });
  });

  describe('update', () => {
    it('should update draft product information', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123',
        'Original description'
      );

      product.update('user-456', 'Updated Product', 'Updated description');

      expect(product.getName()).toBe('Updated Product');
      expect(product.getDescription()).toBe('Updated description');
      expect(product.getUpdatedBy()).toBe('user-456');
      expect(product.getUpdatedAt()).toBeDefined();
    });

    it('should only update provided fields', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      product.update('user-456', 'Updated Product');

      expect(product.getName()).toBe('Updated Product');
      expect(product.getDescription()).toBeUndefined();
    });

    it('should throw ProductNotDraftException when updating non-draft product', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);
      product.publish();

      expect(() => product.update('user-456', 'Updated')).toThrow(ProductNotDraftException);
    });
  });

  describe('addItem', () => {
    it('should add item to draft product', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      expect(product.getItems()).toHaveLength(1);
      expect(product.getItems()[0].getServiceTypeId()).toBe('service-type-1');
    });

    it('should throw DuplicateServiceTypeException for duplicate service type', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item1 = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      const item2 = ProductItem.create('product-123', 'service-type-1', 5, 'user-123');

      product.addItem(item1);

      expect(() => product.addItem(item2)).toThrow(DuplicateServiceTypeException);
    });
  });

  describe('removeItem', () => {
    it('should remove item from draft product', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      // 添加两个items，确保移除一个后还有至少一个item (Add two items to ensure at least one remains after removal)
      const item1 = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      const item2 = ProductItem.create('product-123', 'service-type-2', 20, 'user-123');
      product.addItem(item1);
      product.addItem(item2);

      product.removeItem(item1.getId());

      expect(product.getItems()).toHaveLength(1);
      expect(product.getItems()[0].getId()).toBe(item2.getId());
    });

    it('should throw ProductMinItemsException when removing last item from draft', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      const itemId = item.getId();

      expect(() => product.removeItem(itemId)).toThrow(ProductMinItemsException);
    });

    it('should throw ProductItemNotFoundException for non-existent item', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(() => product.removeItem('non-existent')).toThrow(ProductItemNotFoundException);
    });
  });

  describe('canBePublished', () => {
    it('should return true for draft product with items', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      expect(product.canBePublished()).toBe(true);
    });

    it('should return false for draft product without items', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(product.canBePublished()).toBe(false);
    });

    it('should return false for published product', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);
      product.publish();

      expect(product.canBePublished()).toBe(false);
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      const found = product.getItemById(item.getId());

      expect(found).toBeDefined();
      expect(found?.getId()).toBe(item.getId());
    });

    it('should return undefined for non-existent item', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(product.getItemById('non-existent')).toBeUndefined();
    });
  });

  describe('hasServiceType', () => {
    it('should return true if product has the service type', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      const item = ProductItem.create('product-123', 'service-type-1', 10, 'user-123');
      product.addItem(item);

      expect(product.hasServiceType('service-type-1')).toBe(true);
    });

    it('should return false if product does not have the service type', () => {
      const product = Product.createDraft(
        'product-123',
        'Test Product',
        'TEST-001',
        100,
        'user-123'
      );

      expect(product.hasServiceType('service-type-1')).toBe(false);
    });
  });
});
