import { Test, TestingModule } from "@nestjs/testing";
import { ProductService } from "./product.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { ServiceService } from "../../service/services/service.service";
import { ServicePackageService } from "../../service-package/services/service-package.service";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import { CreateProductDto } from "../dto/create-product.dto";
import { UpdateProductDto } from "../dto/update-product.dto";
import { AddProductItemDto } from "../dto/add-product-item.dto";
import { PublishProductDto } from "../dto/publish-product.dto";
import { ProductStatus, ProductItemType, ServiceStatus, UserType, Currency, ServiceType, BillingMode } from "../../common/interfaces/enums";

describe("ProductService", () => {
  let productService: ProductService;
  let mockDb: jest.Mocked<NodePgDatabase<typeof schema>>;
  let mockServiceService: jest.Mocked<ServiceService>;
  let mockServicePackageService: jest.Mocked<ServicePackageService>;

  // Mock data factories
  const createMockProduct = (overrides: Partial<any> = {}) => ({
    id: "test-product-id",
    name: "Test Product",
    code: "TEST-PRODUCT",
    description: "Test product description",
    coverImage: "https://example.com/image.jpg",
    targetUserTypes: ["undergraduate"],
    price: "99.99",
    currency: "USD",
    validityDays: 30,
    marketingLabels: ["hot"],
    status: ProductStatus.DRAFT,
    scheduledPublishAt: null,
    publishedAt: null,
    unpublishedAt: null,
    sortOrder: 0,
    metadata: { features: ["feature1", "feature2"] },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "test-user-id",
    publishedBy: null,
    unpublishedBy: null,
    ...overrides,
  });

  const createMockService = (overrides: Partial<any> = {}) => ({
    id: "test-service-id",
    code: "TEST-SERVICE",
    serviceType: "resume_review",
    name: "Test Service",
    description: "Test service description",
    coverImage: "https://example.com/service.jpg",
    billingMode: "one_time",
    requiresEvaluation: false,
    requiresMentorAssignment: true,
    status: ServiceStatus.ACTIVE,
    metadata: { features: ["feature1"], duration: 60 },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "test-user-id",
    ...overrides,
  });

  const createMockServicePackage = (overrides: Partial<any> = {}) => ({
    id: "test-package-id",
    code: "TEST-PACKAGE",
    name: "Test Package",
    description: "Test package description",
    coverImage: "https://example.com/package.jpg",
    status: ServiceStatus.ACTIVE,
    metadata: { features: ["feature1"] },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "test-user-id",
    ...overrides,
  });

  const createMockProductItem = (overrides: Partial<any> = {}) => ({
    id: "test-item-id",
    productId: "test-product-id",
    type: ProductItemType.SERVICE,
    referenceId: "test-service-id",
    quantity: 1,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    // Create mock objects
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    } as any;

    mockServiceService = {
      generateSnapshot: jest.fn(),
    } as any;

    mockServicePackageService = {
      generateSnapshot: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: ServiceService,
          useValue: mockServiceService,
        },
        {
          provide: ServicePackageService,
          useValue: mockServicePackageService,
        },
      ],
    }).compile();

    productService = module.get<ProductService>(ProductService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createProductDto: CreateProductDto = {
      name: "Test Product",
      code: "TEST-PRODUCT",
      description: "Test product description",
      coverImage: "https://example.com/image.jpg",
      targetUserTypes: [UserType.UNDERGRADUATE],
      price: 99.99,
      currency: Currency.USD,
      validityDays: 30,
      marketingLabels: ["hot"],
      metadata: { features: ["feature1", "feature2"] },
    };

    it("should successfully create a product", async () => {
      // Arrange
      const mockProduct = createMockProduct();
      const userId = "test-user-id";

      // Mock database calls
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing product with same code
      };

      const mockInsertChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockProduct]),
      };

      const mockTx = {
        insert: jest.fn().mockReturnValue(mockInsertChain),
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        }),
      } as any;

      mockDb.select.mockReturnValue(mockSelectChain as any);
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // Act
      const result = await productService.create(createProductDto, userId);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: mockProduct.id,
          name: mockProduct.name,
          code: mockProduct.code,
          status: ProductStatus.DRAFT,
        }),
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error if product code already exists", async () => {
      // Arrange
      const existingProduct = createMockProduct();
      const userId = "test-user-id";

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingProduct]), // Existing product with same code
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(productService.create(createProductDto, userId)).rejects.toThrow(
        CatalogConflictException,
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should throw error if price is invalid", async () => {
      // Arrange
      const invalidDto = { ...createProductDto, price: -10 };
      const userId = "test-user-id";

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(productService.create(invalidDto, userId)).rejects.toThrow(
        CatalogException,
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should throw error if validity days is invalid", async () => {
      // Arrange
      const invalidDto = { ...createProductDto, validityDays: -5 };
      const userId = "test-user-id";

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(productService.create(invalidDto, userId)).rejects.toThrow(
        CatalogException,
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should throw error if service reference is invalid", async () => {
      // Arrange
      const dtoWithItems = {
        ...createProductDto,
        items: [
          {
            type: "service" as ProductItemType,
            referenceId: "invalid-service-id",
            quantity: 1,
          },
        ],
      };
      const userId = "test-user-id";

      // Mock product code uniqueness check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      // Mock service validation
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]), // No service found
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any);

      // Act & Assert
      await expect(productService.create(dtoWithItems, userId)).rejects.toThrow(
        CatalogNotFoundException,
      );
      expect(mockDb.select).toHaveBeenCalledTimes(2);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const updateProductDto: UpdateProductDto = {
      name: "Updated Product",
      description: "Updated description",
    };

    it("should successfully update a draft product", async () => {
      // Arrange
      const existingProduct = createMockProduct({ status: ProductStatus.DRAFT, publishedAt: null });
      const updatedProduct = { ...existingProduct, ...updateProductDto };

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingProduct]),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);
      mockDb.update.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await productService.update("test-product-id", updateProductDto);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          name: "Updated Product",
          description: "Updated description",
        }),
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.update("non-existent-id", updateProductDto),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw error if product is deleted", async () => {
      // Arrange
      const deletedProduct = createMockProduct({ status: ProductStatus.DELETED });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([deletedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.update("deleted-product-id", updateProductDto),
      ).rejects.toThrow(CatalogGoneException);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw error if product is already published", async () => {
      // Arrange
      const publishedProduct = createMockProduct({
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
      });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([publishedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.update("published-product-id", updateProductDto),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("addItem", () => {
    const addItemDto: AddProductItemDto = {
      type: ProductItemType.SERVICE,
      referenceId: "test-service-id",
      quantity: 1,
      sortOrder: 0,
    };

    it("should successfully add an item to a draft product", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const mockService = createMockService({ id: "test-service-id", status: ServiceStatus.ACTIVE });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock service validation
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]),
      };

      // Mock service validation (for validateProductItems) - .where() returns array
      const mockSelectChainService = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockService]),
      };

      // Mock existing item check - .where().limit() chain
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // No existing item
      };

      // Mock insert
      const mockInsertChain = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)        // product check (with limit)
        .mockReturnValueOnce(mockSelectChainService as any)  // service query in validateProductItems (no limit)
        .mockReturnValueOnce(mockSelectChain3 as any);      // existing item check (with limit)
      mockDb.insert.mockReturnValue(mockInsertChain as any);

      // Act
      await productService.addItem("test-product-id", addItemDto);

      // Assert
      expect(mockDb.select).toHaveBeenCalledTimes(3);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.addItem("non-existent-id", addItemDto),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is not in draft status", async () => {
      // Arrange
      const publishedProduct = createMockProduct({ status: ProductStatus.ACTIVE });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([publishedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.addItem("published-product-id", addItemDto),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if service package quantity is not 1", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const invalidDto = {
        ...addItemDto,
        type: "service_package" as ProductItemType,
        quantity: 2,
      };

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.addItem("test-product-id", invalidDto),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if item already exists in product", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const mockService = createMockService({ id: "test-service-id", status: ServiceStatus.ACTIVE });
      const existingItem = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE,
        referenceId: "test-service-id",
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock service validation (for validateProductItems) - .where() returns array
      const mockSelectChainService = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockService]),
      };

      // Mock existing item check - .where().limit() chain
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingItem]), // Existing item found
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)        // product check (with limit)
        .mockReturnValueOnce(mockSelectChainService as any)  // service query in validateProductItems (no limit)
        .mockReturnValueOnce(mockSelectChain3 as any);      // existing item check (with limit)

      // Act & Assert
      await expect(
        productService.addItem("test-product-id", addItemDto),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(3);
    });
  });

  describe("removeItem", () => {
    it("should successfully remove an item from a draft product", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const existingItem = createMockProductItem({
        id: "test-item-id",
        productId: "test-product-id",
      });
      const anotherItem = createMockProductItem({
        id: "another-item-id",
        productId: "test-product-id",
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock items check (product has at least 2 items)
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([existingItem, anotherItem]),
      };

      // Mock delete
      const mockDeleteChain = {
        where: jest.fn().mockReturnThis(),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any);
      mockDb.delete.mockReturnValue(mockDeleteChain as any);

      // Act
      await productService.removeItem("test-product-id", "test-item-id");

      // Assert
      expect(mockDb.select).toHaveBeenCalledTimes(2);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.removeItem("non-existent-id", "test-item-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is not in draft status", async () => {
      // Arrange
      const publishedProduct = createMockProduct({ status: ProductStatus.ACTIVE });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([publishedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.removeItem("published-product-id", "test-item-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product has only one item", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const onlyItem = createMockProductItem({
        id: "test-item-id",
        productId: "test-product-id",
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock items check (product has only 1 item) - no .limit() in actual code
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([onlyItem]),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any);

      // Act & Assert
      await expect(
        productService.removeItem("test-product-id", "test-item-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });
  });

  describe("publish", () => {
    const publishProductDto: PublishProductDto = {};

    it("should successfully publish a draft product", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const publishedProduct = {
        ...draftProduct,
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
      };
      const userId = "test-user-id";

      const mockItem = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE,
        referenceId: "test-service-id",
      });
      const mockService = createMockService({
        id: "test-service-id",
        status: ServiceStatus.ACTIVE,
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock items check (product has at least 1 item)
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockItem]),
      };

      // Mock all items fetch
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockItem]),
      };

      // Mock service validation
      const mockSelectChain4 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockService]),
      };

      // Mock publish
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([publishedProduct]),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any)
        .mockReturnValueOnce(mockSelectChain4 as any);
      mockDb.update.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await productService.publish("test-product-id", publishProductDto, userId);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          status: ProductStatus.ACTIVE,
        }),
      );
      expect(mockDb.select).toHaveBeenCalledTimes(4);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.publish("non-existent-id", publishProductDto, "test-user-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is not in draft status", async () => {
      // Arrange
      const publishedProduct = createMockProduct({ status: ProductStatus.ACTIVE });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([publishedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.publish("published-product-id", publishProductDto, "test-user-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product has no items", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock items check (product has no items)
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any);

      // Act & Assert
      await expect(
        productService.publish("test-product-id", publishProductDto, "test-user-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it("should throw error if referenced service is not active", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });
      const mockItem = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE,
        referenceId: "test-service-id",
      });
      const inactiveService = createMockService({
        id: "test-service-id",
        status: ServiceStatus.INACTIVE,
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock items check (product has at least 1 item)
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockItem]),
      };

      // Mock all items fetch
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockItem]),
      };

      // Mock service validation
      const mockSelectChain4 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([inactiveService]),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any)
        .mockReturnValueOnce(mockSelectChain4 as any);

      // Act & Assert
      await expect(
        productService.publish("test-product-id", publishProductDto, "test-user-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(4);
    });
  });

  describe("unpublish", () => {
    it("should successfully unpublish an active product", async () => {
      // Arrange
      const activeProduct = createMockProduct({ status: ProductStatus.ACTIVE });
      const unpublishedProduct = {
        ...activeProduct,
        status: ProductStatus.INACTIVE,
        unpublishedAt: new Date(),
      };
      const userId = "test-user-id";
      const reason = "Test reason";

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([activeProduct]),
      };

      // Mock unpublish
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([unpublishedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);
      mockDb.update.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await productService.unpublish("test-product-id", reason, userId);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          status: ProductStatus.INACTIVE,
        }),
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.unpublish("non-existent-id", "Test reason", "test-user-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is not active", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.unpublish("draft-product-id", "Test reason", "test-user-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if reason is not provided", async () => {
      // Act & Assert
      await expect(
        productService.unpublish("test-product-id", "", "test-user-id"),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("revertToDraft", () => {
    it("should successfully revert an inactive product to draft", async () => {
      // Arrange
      const inactiveProduct = createMockProduct({ status: ProductStatus.INACTIVE });
      const revertedProduct = {
        ...inactiveProduct,
        status: ProductStatus.DRAFT,
      };

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([inactiveProduct]),
      };

      // Mock revert
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([revertedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);
      mockDb.update.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await productService.revertToDraft("test-product-id");

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          status: ProductStatus.DRAFT,
        }),
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.revertToDraft("non-existent-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is not inactive", async () => {
      // Arrange
      const activeProduct = createMockProduct({ status: ProductStatus.ACTIVE });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([activeProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.revertToDraft("active-product-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  describe("remove", () => {
    it("should successfully delete a draft product", async () => {
      // Arrange
      const draftProduct = createMockProduct({ status: ProductStatus.DRAFT, publishedAt: null });
      const deletedProduct = {
        ...draftProduct,
        status: ProductStatus.DELETED,
      };

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([draftProduct]),
      };

      // Mock delete
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([deletedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);
      mockDb.update.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await productService.remove("test-product-id");

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          status: ProductStatus.DELETED,
        }),
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.remove("non-existent-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is already deleted", async () => {
      // Arrange
      const deletedProduct = createMockProduct({ status: ProductStatus.DELETED });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([deletedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.remove("deleted-product-id"),
      ).rejects.toThrow(CatalogGoneException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is already published", async () => {
      // Arrange
      const publishedProduct = createMockProduct({
        status: "active",
        publishedAt: new Date(),
      });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([publishedProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.remove("published-product-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  describe("restore", () => {
    it("should successfully restore a deleted product", async () => {
      // Arrange
      const deletedProduct = createMockProduct({ status: ProductStatus.DELETED });
      const restoredProduct = {
        ...deletedProduct,
        status: ProductStatus.DRAFT,
      };

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([deletedProduct]),
      };

      // Mock restore
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([restoredProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);
      mockDb.update.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await productService.restore("test-product-id");

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          status: ProductStatus.DRAFT,
        }),
      );
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.restore("non-existent-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if product is not deleted", async () => {
      // Arrange
      const activeProduct = createMockProduct({ status: ProductStatus.ACTIVE });

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([activeProduct]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(
        productService.restore("active-product-id"),
      ).rejects.toThrow(CatalogException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  describe("findOne", () => {
    it("should successfully find a product by id", async () => {
      // Arrange
      const product = createMockProduct();
      const item = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE,
        referenceId: "test-service-id",
      });
      const service = createMockService({
        id: "test-service-id",
        status: ServiceStatus.ACTIVE,
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([product]),
      };

      // Mock items check - should return array, .orderBy() ends the chain
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([item]), // items query ends with .orderBy()
      };

      // Mock service check for the service referenced in the item
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([service]), // service query in findOne
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)  // product check
        .mockReturnValueOnce(mockSelectChain2 as any) // items query
        .mockReturnValueOnce(mockSelectChain3 as any); // service query for item

      // Act
      const result = await productService.findOne({ id: "test-product-id" });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          name: "Test Product",
          items: [
            expect.objectContaining({
              type: ProductItemType.SERVICE,
              referenceId: "test-service-id",
              service: expect.objectContaining({
                id: "test-service-id",
              }),
            }),
          ],
        }),
      );
      expect(mockDb.select).toHaveBeenCalledTimes(3); // product, items, and service queries
    });

    it("should successfully find a product by code", async () => {
      // Arrange
      const product = createMockProduct({ code: "TEST-PRODUCT" });
      const item = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE_PACKAGE,
        referenceId: "test-package-id",
      });
      const servicePackage = createMockServicePackage({
        id: "test-package-id",
        status: ServiceStatus.ACTIVE,
      });

      // Mock product check
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([product]),
      };

      // Mock items check - .orderBy() returns array
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([item]),
      };

      // Mock service package check - .where() returns array
      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([servicePackage]),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)  // product check
        .mockReturnValueOnce(mockSelectChain2 as any) // items query
        .mockReturnValueOnce(mockSelectChain3 as any); // package check (serviceIds is empty)

      // Act
      const result = await productService.findOne({ code: "TEST-PRODUCT" });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "test-product-id",
          code: "TEST-PRODUCT",
          name: "Test Product",
          items: [
            expect.objectContaining({
              type: ProductItemType.SERVICE_PACKAGE,
              referenceId: "test-package-id",
              servicePackage: expect.objectContaining({
                id: "test-package-id",
              }),
            }),
          ],
        }),
      );
      expect(mockDb.select).toHaveBeenCalledTimes(3); // product, items, and package queries (serviceIds is empty)
    });

    it("should return null if product does not exist", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockSelectChain as any);

      // Act
      const result = await productService.findOne({ id: "non-existent-id" });

      // Assert
      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should throw error if no id or code is provided", async () => {
      // Act & Assert
      await expect(productService.findOne({})).rejects.toThrow(CatalogException);
    });
  });

  describe("search", () => {
    it("should successfully search products with pagination", async () => {
      // Arrange
      const product = createMockProduct();
      const products = [product];
      
      // Mock count query - .where() directly returns array
      const mockCountSelectChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ total: 1 }]), // where returns array directly
      };

      // Mock search query - chain ends with .offset() which returns array
      const mockSearchSelectChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue(products), // offset returns array
      };
      // Make the chain work properly - limit returns the chain, offset returns data
      mockSearchSelectChain.limit.mockReturnValue(mockSearchSelectChain);

      mockDb.select
        .mockReturnValueOnce(mockCountSelectChain as any)
        .mockReturnValueOnce(mockSearchSelectChain as any);

      // Act
      const result = await productService.search(
        { keyword: "test" },
        { page: 1, pageSize: 20 }
      );

      // Assert
      expect(result).toEqual({
        data: [expect.objectContaining({ id: "test-product-id" })],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it("should successfully search products without pagination", async () => {
      // Arrange
      const product = createMockProduct();
      const products = [product];
      
      // Mock count query - .where() directly returns array
      const mockCountSelectChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ total: 1 }]), // where returns array directly
      };

      // Mock search query - chain ends with .orderBy() which returns array (no pagination)
      const mockSearchSelectChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(products), // orderBy returns array
      };

      mockDb.select
        .mockReturnValueOnce(mockCountSelectChain as any)
        .mockReturnValueOnce(mockSearchSelectChain as any);

      // Act
      const result = await productService.search({ keyword: "test" });

      // Assert
      expect(result).toEqual({
        data: [expect.objectContaining({ id: "test-product-id" })],
        total: 1,
        page: 1,
        pageSize: 1,
        totalPages: 1,
      });
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it("should successfully search products with keyword filter", async () => {
      // Arrange
      const product = createMockProduct({ name: "Matching Product" });
      const products = [product];
      
      // Mock count query - .where() directly returns array
      const mockCountSelectChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ total: 1 }]), // where returns array directly
      };

      // Mock search query - chain ends with .orderBy() which returns array (no pagination)
      const mockSearchSelectChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(products), // orderBy returns array
      };

      const selectSpy = jest.spyOn(mockDb, 'select');
      mockDb.select
        .mockReturnValueOnce(mockCountSelectChain as any)
        .mockReturnValueOnce(mockSearchSelectChain as any);

      // Act
      const result = await productService.search({
        keyword: "matching",
      });

      // Assert
      expect(result).toEqual({
        data: [expect.objectContaining({ name: "Matching Product" })],
        total: 1,
        page: 1,
        pageSize: 1,
        totalPages: 1,
      });
      expect(selectSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("generateSnapshot", () => {
    it("should successfully generate a product snapshot", async () => {
      // Arrange
      const product = createMockProduct();
      const item = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE,
        referenceId: "test-service-id",
      });
      const mockService = createMockService({
        id: "test-service-id",
        status: ServiceStatus.ACTIVE,
      });
      const serviceSnapshot = {
        serviceId: "test-service-id",
        serviceName: "Test Service",
        serviceCode: "TEST-SERVICE",
        serviceType: ServiceType.RESUME_REVIEW,
        billingMode: BillingMode.ONE_TIME,
        requiresEvaluation: false,
        requiresMentorAssignment: true,
        metadata: {
          features: ["Feature 1", "Feature 2"],
          deliverables: ["Deliverable 1", "Deliverable 2"],
          duration: 60,
        },
        snapshotAt: new Date(),
      };

      // Mock findOne call
      jest.spyOn(productService, "findOne").mockResolvedValue({
        ...product,
        items: [item],
      } as any);

      // Mock service snapshot generation
      mockServiceService.generateSnapshot.mockResolvedValue(serviceSnapshot);

      // Act
      const result = await productService.generateSnapshot("test-product-id");

      // Assert
      expect(result).toEqual({
        productId: "test-product-id",
        productName: "Test Product",
        productCode: "TEST-PRODUCT",
        price: "99.99",
        currency: Currency.USD,
        validityDays: 30,
        items: [
          {
            type: ProductItemType.SERVICE,
            quantity: 1,
            sortOrder: 0,
            serviceSnapshot,
          },
        ],
        snapshotAt: expect.any(Date),
      });
      expect(productService.findOne).toHaveBeenCalledWith({ id: "test-product-id" });
      expect(mockServiceService.generateSnapshot).toHaveBeenCalledWith(
        "test-service-id",
      );
    });

    it("should throw error if product does not exist", async () => {
      // Arrange
      jest.spyOn(productService, "findOne").mockResolvedValue(null);

      // Act & Assert
      await expect(
        productService.generateSnapshot("non-existent-id"),
      ).rejects.toThrow(CatalogNotFoundException);
      expect(productService.findOne).toHaveBeenCalledWith({ id: "non-existent-id" });
    });

    it("should successfully generate a product snapshot with service package", async () => {
      // Arrange
      const product = createMockProduct();
      const item = createMockProductItem({
        productId: "test-product-id",
        type: ProductItemType.SERVICE_PACKAGE,
        referenceId: "test-package-id",
      });
      const servicePackage = createMockServicePackage({
        id: "test-package-id",
        status: ServiceStatus.ACTIVE,
      });
      const packageSnapshot = {
        packageId: "test-package-id",
        packageName: "Test Package",
        packageCode: "TEST-PACKAGE",
        items: [],
        snapshotAt: new Date(),
      };

      // Mock findOne call
      jest.spyOn(productService, "findOne").mockResolvedValue({
        ...product,
        items: [item],
      } as any);

      // Mock package snapshot generation
      mockServicePackageService.generateSnapshot.mockResolvedValue(packageSnapshot);

      // Act
      const result = await productService.generateSnapshot("test-product-id");

      // Assert
      expect(result).toEqual({
        productId: "test-product-id",
        productName: "Test Product",
        productCode: "TEST-PRODUCT",
        price: "99.99",
        currency: "USD",
        validityDays: 30,
        items: [
          {
            type: ProductItemType.SERVICE_PACKAGE,
            quantity: 1,
            sortOrder: 0,
            servicePackageSnapshot: packageSnapshot,
          },
        ],
        snapshotAt: expect.any(Date),
      });
      expect(productService.findOne).toHaveBeenCalledWith({ id: "test-product-id" });
      expect(mockServicePackageService.generateSnapshot).toHaveBeenCalledWith(
        "test-package-id",
      );
    });
  });
});
