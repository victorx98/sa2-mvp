import { Test, TestingModule } from "@nestjs/testing";
import { ProductService } from "./product.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
} from "@domains/catalog/common/exceptions/catalog.exception";
import { CATALOG_ERROR_MESSAGES } from "@domains/catalog/common/exceptions/catalog.exception";
import { CreateProductDto } from "../dto/create-product.dto";
import { AddProductItemDto } from "../dto/add-product-item.dto";
import { UpdateProductDto } from "../dto/update-product.dto";
import {
  Currency,
  ProductStatus,
  ServiceUnit,
  UserPersona,
} from "@shared/types/catalog-enums";
import { randomUUID } from "crypto";
import { ProductFilterDto } from "../dto/product-filter.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { IProductDetail } from "../interfaces";

// Mock data generators [模拟数据生成器]
const generateMockProduct = (overrides: Partial<any> = {}) => {
  const timestamp = Date.now();
  const id = randomUUID();

  return {
    id,
    name: `Test Product ${timestamp}`, // Use timestamp for uniqueness [使用时间戳确保唯一性]
    code: `CODE-${timestamp.toString().slice(-6)}`, // Use timestamp slice for code [使用时间戳片段作为代码]
    description: `Test product description created at ${new Date().toISOString()}`,
    coverImage: `https://example.com/images/${id}.jpg`,
    price: (Math.floor(Math.random() * 990) + 10).toFixed(2), // Random price between 10-1000 [10-1000之间的随机价格]
    currency: Currency.USD, // Use enum value directly [直接使用枚举值]
    targetUserPersona: [UserPersona.UNDERGRADUATE], // Use enum value directly [直接使用枚举值]
    marketingLabels: ["hot", "new", "recommended"], // Use fixed array [使用固定数组]
    status: ProductStatus.DRAFT,
    publishedAt: null,
    unpublishedAt: null,
    metadata: {
      features: [`Feature ${timestamp}`],
      faqs: [
        {
          question: `Question ${timestamp}?`,
          answer: `Answer created at ${new Date().toISOString()}`,
        },
      ],
      deliverables: [`Deliverable ${timestamp}`],
      duration: `${Math.floor(Math.random() * 10) + 1} hours`,
      prerequisites: [`Prerequisite ${timestamp}`],
    },
    createdBy: randomUUID(),
    updatedBy: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [], // Add items property [添加items属性]
    ...overrides,
  };
};

const generateMockProductItem = (overrides: Partial<any> = {}) => {
  return {
    id: randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    productId:
      randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    serviceTypeId:
      randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    quantity: Math.floor(Math.random() * 10) + 1, // Random quantity 1-10 [1-10之间的随机数量]
    sortOrder: Math.floor(Math.random() * 100), // Random sort order 0-99 [0-99之间的随机排序]
    createdBy:
      randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    updatedBy:
      randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

const generateMockServiceType = (
  overrides: Partial<{
    id: string;
    name: string;
    code: string;
    description: string;
    unit: ServiceUnit;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) => {
  const timestamp = Date.now();
  return {
    id: randomUUID(),
    name: `Service Type ${timestamp}`, // Use timestamp for uniqueness [使用时间戳确保唯一性]
    code: `SERVICE-${timestamp.toString().slice(-8)}`, // Use timestamp slice for code [使用时间戳片段作为代码]
    description: `Service type description created at ${new Date().toISOString()}`,
    unit: ServiceUnit.UNIT,
    status: "ACTIVE", // Match database schema (not isActive) [匹配数据库模式（不是isActive）]
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

// Helper functions for test data [测试数据辅助函数]

describe("ProductService", () => {
  let mockDb: any;
  let service: ProductService;

  beforeEach(async () => {
    // Create a proper mock for Drizzle's chained methods
    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
            orderBy: jest.fn().mockResolvedValue([]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
      transaction: jest.fn().mockImplementation(async (callback) => {
        // Execute the callback with the mockDb itself as the transaction context
        return callback(mockDb);
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  beforeEach(() => {
    // Reset all mocks before each test [在每个测试前重置所有模拟]
    jest.clearAllMocks();

    // Re-setup mock implementations after clearing [清除后重新设置模拟实现]
    // Use mockImplementation to allow dynamic mock behavior per test [使用mockImplementation以允许每个测试的动态mock行为]
    mockDb.select = jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValue([]),
          orderBy: jest.fn().mockResolvedValue([]),
          for: jest.fn().mockImplementation(() => ({
            limit: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
    }));

    mockDb.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([]),
      }),
    });

    mockDb.update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDb.delete = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([]),
      }),
    });

    mockDb.transaction = jest.fn().mockImplementation(async (callback) => {
      // Execute the callback with the mockDb itself as the transaction context
      return callback(mockDb);
    });
  });

  describe("updateItemSortOrder", () => {
    it("should update item sort order successfully [应该成功更新项目排序]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const itemId = randomUUID();
      const newSortOrder = 1;
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.DRAFT; // Ensure product is in draft status [确保产品处于草稿状态]

      const mockProductItem = { id: itemId, productId };

      // Mock first select (product items query to get productId) [Mock第一次查询（产品项查询以获取产品ID）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockProductItem]),
        }),
      });

      // Mock second select (product query with row lock) [Mock第二次查询（带行锁的产品查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
            }),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // Act [执行]
      await service.updateItemSortOrder([
        { itemId, sortOrder: newSortOrder },
      ]);

      // Assert [断言]
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw exception when items array is empty [当 items 数组为空时抛出异常]", async () => {
      // Act & Assert [执行与断言]
      await expect(service.updateItemSortOrder([])).rejects.toThrow(
        CatalogException,
      );
      await expect(service.updateItemSortOrder([])).rejects.toThrow(
        "Items array cannot be empty",
      );
    });

    it("should throw exception when product item is not found [当产品项未找到时抛出异常]", async () => {
      // Arrange [准备]
      const itemId = randomUUID();

      // Mock database to return no product item [模拟数据库返回无产品项]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(
        service.updateItemSortOrder([{ itemId, sortOrder: 1 }]),
      ).rejects.toThrow(CatalogNotFoundException);
      await expect(
        service.updateItemSortOrder([{ itemId, sortOrder: 1 }]),
      ).rejects.toThrow("Product item not found");
    });

    it("should throw exception when items belong to different products [当 items 属于不同产品时抛出异常]", async () => {
      // Arrange [准备]
      const productId1 = randomUUID();
      const productId2 = randomUUID();
      const itemId1 = randomUUID();
      const itemId2 = randomUUID();

      const mockProductItems = [
        { id: itemId1, productId: productId1 },
        { id: itemId2, productId: productId2 },
      ];

      // Mock product items query [Mock产品项查询]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockProductItems),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(
        service.updateItemSortOrder([
          { itemId: itemId1, sortOrder: 1 },
          { itemId: itemId2, sortOrder: 2 },
        ]),
      ).rejects.toThrow(CatalogException);
      await expect(
        service.updateItemSortOrder([
          { itemId: itemId1, sortOrder: 1 },
          { itemId: itemId2, sortOrder: 2 },
        ]),
      ).rejects.toThrow("All items must belong to the same product");
    });

    it("should throw exception when product is not found [当产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const itemId = randomUUID();
      const mockProductItem = { id: itemId, productId };

      // Mock first select (product items query) [Mock第一次查询（产品项查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockProductItem]),
        }),
      });

      // Mock second select (product query returns empty) [Mock第二次查询（产品查询返回空）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(
        service.updateItemSortOrder([{ itemId, sortOrder: 1 }]),
      ).rejects.toThrow(CatalogNotFoundException);
      await expect(
        service.updateItemSortOrder([{ itemId, sortOrder: 1 }]),
      ).rejects.toThrow("Product not found");
    });

    it("should throw exception when product is not in draft status [当产品不是草稿状态时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const itemId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.ACTIVE; // Product is not in draft status [产品不是草稿状态]

      const mockProductItem = { id: itemId, productId };

      // Mock first select (product items query) [Mock第一次查询（产品项查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockProductItem]),
        }),
      });

      // Mock second select (product query) [Mock第二次查询（产品查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
            }),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(
        service.updateItemSortOrder([{ itemId, sortOrder: 1 }]),
      ).rejects.toThrow(CatalogException);
      await expect(
        service.updateItemSortOrder([{ itemId, sortOrder: 1 }]),
      ).rejects.toThrow("Product is not in draft status");
    });
  });

  describe("create", () => {
    it("should create a product successfully [应该成功创建产品]", async () => {
      // Arrange [准备]
      const userId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const timestamp = Date.now();
      const createProductDto: CreateProductDto = {
        name: `Test Product ${timestamp}`, // Use timestamp instead of faker [使用时间戳替代faker]
        code: `CODE-${timestamp.toString().slice(-6)}`, // Use timestamp slice instead of faker [使用时间戳片段替代faker]
        description: `Test product description created at ${new Date().toISOString()}`, // Use timestamp instead of faker [使用时间戳替代faker]
        coverImage: `https://example.com/images/${randomUUID()}.jpg`, // Use randomUUID instead of faker [使用randomUUID替代faker]
        price: 130, // Use Math.random instead of faker [使用Math.random替代faker]
        currency: Currency.CNY,
        targetUserPersonas: [UserPersona.UNDERGRADUATE], // Use targetUserPersonas field as defined in CreateProductDto [使用CreateProductDto中定义的targetUserPersonas字段]
        marketingLabels: ["hot"],
        metadata: {
          features: [`Feature ${timestamp}`], // Use timestamp instead of faker [使用时间戳替代faker]
          faqs: [
            {
              question: `Question ${timestamp}?`, // Use timestamp instead of faker [使用时间戳替代faker]
              answer: `Answer created at ${new Date().toISOString()}`, // Use timestamp instead of faker [使用时间戳替代faker]
            },
          ],
        },
        items: [
          {
            serviceTypeId: randomUUID(), // Use randomUUID instead of faker [使用randomUUID替代faker]
            quantity: Math.floor(Math.random() * 10) + 1, // Use Math.random instead of faker [使用Math.random替代faker]
            sortOrder: 0,
          },
        ],
      };

      const mockProduct = generateMockProduct();
      const mockProductItems = [generateMockProductItem()];
      const mockServiceTypes = [generateMockServiceType()];

      // Mock database operations with chainable methods [使用链式方法模拟数据库操作]
      const originalSelect = mockDb.select;
      let selectCallCount = 0;

      mockDb.select = jest.fn(() => {
        selectCallCount++;

        // First call: check product code uniqueness (with limit) [第一次调用：检查产品代码唯一性（带limit）]
        if (selectCallCount === 1) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue([]),
                for: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              })),
            })),
          };
        }

        // Second call: batch service type validation (without limit) [第二次调用：批量服务类型验证（不带limit）]
        if (selectCallCount === 2) {
          return {
            from: jest.fn(() => ({
              where: jest.fn().mockResolvedValue(mockServiceTypes),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockServiceTypes),
              }),
            })),
          };
        }

        // Fallback to original behavior [回退到原始行为]
        return originalSelect();
      });

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockProduct]),
        }),
      });

      // Mock product items insertion [模拟产品项插入]
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(mockProductItems),
        }),
      });

      // Mock transaction [模拟事务]
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback(mockDb);
      });

      // Act [执行]
      const result = await service.create(createProductDto, userId);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.id).toBe(mockProduct.id);
      expect(result.name).toBe(mockProduct.name); // Use mockProduct.name instead of createProductDto.name
      expect(result.code).toBe(mockProduct.code); // Use mockProduct.code instead of createProductDto.code
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw exception when product code already exists [当产品代码已存在时抛出异常]", async () => {
      // Arrange [准备]
      const userId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const timestamp = Date.now();
      const createProductDto: CreateProductDto = {
        name: `Test Product ${timestamp}`, // Use timestamp instead of faker [使用时间戳替代faker]
        code: `CODE-${timestamp.toString().slice(-6)}`, // Use timestamp slice instead of faker [使用时间戳片段替代faker]
        price: 120, // Use Math.random instead of faker [使用Math.random替代faker]
      };

      const existingProduct = generateMockProduct();
      existingProduct.code = createProductDto.code;

      // Mock database to return existing product [模拟数据库返回已存在的产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingProduct]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.create(createProductDto, userId)).rejects.toThrow(
        new CatalogConflictException("PRODUCT_CODE_DUPLICATE"),
      );
    });

    it("should throw exception when service type is not found [当服务类型未找到时抛出异常]", async () => {
      // Arrange [准备]
      const userId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const timestamp = Date.now();
      const createProductDto: CreateProductDto = {
        name: `Test Product ${timestamp}`, // Use timestamp instead of faker [使用时间戳替代faker]
        code: `CODE-${timestamp.toString().slice(-6)}`, // Use timestamp slice instead of faker [使用时间戳片段替代faker]
        price: 120, // Use Math.random instead of faker [使用Math.random替代faker]
        items: [
          {
            serviceTypeId: "invalid-uuid", // Invalid UUID to trigger validation error [无效的UUID以触发验证错误]
            quantity: Math.floor(Math.random() * 10) + 1, // Use Math.random instead of faker [使用Math.random替代faker]
            sortOrder: 0,
          },
        ],
      };

      // Mock database to return no existing product [模拟数据库返回无已存在的产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.create(createProductDto, userId)).rejects.toThrow(
        CatalogNotFoundException,
      );
      await expect(service.create(createProductDto, userId)).rejects.toThrow(
        CATALOG_ERROR_MESSAGES.INVALID_REFERENCE_ID,
      );
    });
  });

  describe("update", () => {
    it("should update a product successfully [应该成功更新产品]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const timestamp = Date.now();
      const updateProductDto: UpdateProductDto = {
        name: `Updated Product ${timestamp}`, // Use timestamp instead of faker [使用时间戳替代faker]
        description: `Updated description at ${new Date().toISOString()}`, // Use timestamp instead of faker [使用时间戳替代faker]
        price: parseFloat((Math.random() * 990 + 10).toFixed(2)), // Use Math.random instead of faker [使用Math.random替代faker]
        targetUserPersonas: [UserPersona.GRADUATE], // Use targetUserPersonas field as defined in UpdateProductDto [使用UpdateProductDto中定义的targetUserPersonas字段]
      };

      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.DRAFT; // Ensure product is in draft status [确保产品处于草稿状态]

      const updatedProduct = { ...existingProduct, ...updateProductDto };

      // Mock database to find existing product [模拟数据库查找已存在的产品]
      const mockFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([existingProduct]),
        }),
      });
      mockDb.select.mockReturnValue({ from: mockFrom });

      // Mock database update [模拟数据库更新]
      const mockReturning = jest.fn().mockResolvedValue([updatedProduct]);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act [执行]
      const result = await service.update(productId, updateProductDto);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.id).toBe(productId);
      expect(result.name).toBe(updateProductDto.name);
      expect(result.description).toBe(updateProductDto.description);
      expect(result.price).toBe(updateProductDto.price.toString()); // Convert to string for comparison [转换为字符串进行比较]
    });

    it("should throw exception when product to update is not found [当要更新的产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const timestamp = Date.now();
      const updateProductDto = {
        name: `Updated Product ${timestamp}`, // Use timestamp instead of faker [使用时间戳替代faker]
      };

      // Mock database operations [模拟数据库操作]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.update(productId, updateProductDto)).rejects.toThrow(
        new CatalogNotFoundException("PRODUCT_NOT_FOUND"),
      );
    });
  });

  describe("addItem", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should add item to product successfully [应该成功向产品添加项]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const addItemDto: AddProductItemDto = {
        serviceTypeId: randomUUID(),
        quantity: Math.floor(Math.random() * 10) + 1,
        sortOrder: 0,
      };

      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.DRAFT;

      // Create service type with the ID from addItemDto
      const mockServiceType = generateMockServiceType({
        id: addItemDto.serviceTypeId,
      });

      // Strategy: Create a flexible mock that works for all three select calls by tracking state
      const selectMock = jest.fn();
      let callCount = 0;

      // Track all select calls and return appropriate mock structure
      selectMock.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // First call: check product exists
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([existingProduct]),
                for: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([existingProduct]),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          // Second call: batch service type validation
          // This query is .select().from().where(inArray)
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([mockServiceType]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockServiceType]),
              }),
            }),
          };
        }

        if (callCount === 3) {
          // Third call: check item exists
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([]),
                for: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          };
        }

        // Should not reach here
        return {from: jest.fn()};
      });

      mockDb.select = selectMock;

      // Mock database insertion
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act & Assert
      await service.addItem(productId, addItemDto);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw CatalogNotFoundException when product does not exist [当产品不存在时应该抛出CatalogNotFoundException]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const addItemDto: AddProductItemDto = {
        serviceTypeId: randomUUID(), // Use randomUUID instead of faker [使用randomUUID替代faker]
        quantity: Math.floor(Math.random() * 10) + 1, // Use Math.random instead of faker [使用Math.random替代faker]
        sortOrder: 0,
      };

      // Mock database to return no product [模拟数据库返回无产品]
      const mockFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
          for: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.select.mockReturnValue({ from: mockFrom });

      // Act & Assert [执行与断言]
      await expect(service.addItem(productId, addItemDto)).rejects.toThrow(
        CatalogNotFoundException,
      );
    });

    it("should throw CatalogException when service type is not found [当服务类型未找到时应该抛出CatalogException]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const addItemDto: AddProductItemDto = {
        serviceTypeId: "invalid-uuid", // Invalid UUID to trigger validation error [无效的UUID以触发验证错误]
        quantity: Math.floor(Math.random() * 10) + 1, // Use Math.random instead of faker [使用Math.random替代faker]
        sortOrder: 0,
      };

      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.DRAFT; // Ensure product is in draft status [确保产品处于草稿状态]

      // Mock database to find existing product first [模拟数据库查找已存在的产品]
      const productMockFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([existingProduct]),
          for: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingProduct]),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({ from: productMockFrom });

      // Mock database to check if item already exists - must return empty array [模拟检查是否已存在 - 必须返回空数组]
      const itemMockFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
          for: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({ from: itemMockFrom });

      // Act & Assert [执行与断言]
      // The service should validate UUID format in validateProductItemReferences method [服务应在validateProductItemReferences方法中验证UUID格式]
      await expect(service.addItem(productId, addItemDto)).rejects.toThrow(
        CatalogNotFoundException,
      );
      await expect(service.addItem(productId, addItemDto)).rejects.toThrow(
        CATALOG_ERROR_MESSAGES.INVALID_REFERENCE_ID,
      );
    });

    it("should throw exception when item already exists [当项已存在时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const addItemDto: AddProductItemDto = {
        serviceTypeId: randomUUID(),
        quantity: Math.floor(Math.random() * 10) + 1,
        sortOrder: 0,
      };

      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.DRAFT;

      const existingItem = generateMockProductItem();
      existingItem.productId = productId;
      existingItem.serviceTypeId =
        addItemDto.serviceTypeId as `${string}-${string}-${string}-${string}-${string}`;

      // Create service type with the ID from addItemDto
      const mockServiceType = generateMockServiceType({
        id: addItemDto.serviceTypeId,
      });

      // Set up mock for product exists check (returns product with draft status)
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([existingProduct]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([existingProduct]),
              }),
            }),
          }),
        })
        // Set up mock for service type validation (returns service type)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockServiceType]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockServiceType]),
            }),
          }),
        })
        // Set up mock for item exists check (returns existing item)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([existingItem]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([existingItem]),
              }),
            }),
          }),
        })
        // Set up mocks for the second call to addItem
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([existingProduct]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([existingProduct]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockServiceType]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockServiceType]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([existingItem]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([existingItem]),
              }),
            }),
          }),
        });

      // Act & Assert
      await expect(service.addItem(productId, addItemDto)).rejects.toThrow(
        CatalogException,
      );
      await expect(service.addItem(productId, addItemDto)).rejects.toThrow(
        CATALOG_ERROR_MESSAGES.ITEM_ALREADY_IN_PRODUCT,
      );
    });
  });

  describe("removeItem", () => {
    it("should remove item from product successfully [应该成功从产品中移除项]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const itemId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.DRAFT; // Ensure product is in draft status [确保产品处于草稿状态]

      const mockProductItem = { productId };
      const mockItems = [
        { id: itemId, productId, serviceTypeId: randomUUID() }, // Use randomUUID instead of faker [使用randomUUID替代faker]
        { id: randomUUID(), productId, serviceTypeId: randomUUID() }, // Use randomUUID instead of faker [使用randomUUID替代faker]
      ];

      // Mock first select (product item query to get productId) [Mock第一次查询（产品项查询以获取产品ID）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProductItem]),
          }),
        }),
      });

      // Mock second select (product query with row lock) [Mock第二次查询（带行锁的产品查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
            }),
          }),
        }),
      });

      // Mock third select (product items query) [Mock第三次查询（产品项查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockItems),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      // Act [执行]
      await service.removeItem(itemId);

      // Assert [断言]
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should throw exception when product item is not found [当产品项未找到时抛出异常]", async () => {
      // Arrange [准备]
      const itemId = randomUUID();

      // Mock database to return no product item [模拟数据库返回无产品项]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.removeItem(itemId)).rejects.toThrow(
        CatalogNotFoundException,
      );
      await expect(service.removeItem(itemId)).rejects.toThrow(
        "Product item not found",
      );
    });

    it("should throw exception when product is not found [当产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const itemId = randomUUID();
      const mockProductItem = { productId };

      // Mock first select (product item query) [Mock第一次查询（产品项查询）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProductItem]),
          }),
        }),
      });

      // Mock second select (product query returns empty) [Mock第二次查询（产品查询返回空）]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.removeItem(itemId)).rejects.toThrow(
        CatalogNotFoundException,
      );
      await expect(service.removeItem(itemId)).rejects.toThrow(
        "Product not found",
      );
    });

    it("should throw exception when product has only one item [当产品只有一个项时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const itemId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.DRAFT;

      const mockProductItem = { productId };
      const mockItems = [
        { id: itemId, productId, serviceTypeId: randomUUID() },
      ];

      // Configure mock for multiple calls [配置mock以处理多次调用]
      // First call: product item query [第一次调用：产品项查询]
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProductItem]),
            }),
          }),
        })
        // Second call: product query [第二次调用：产品查询]
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockProduct]),
              }),
            }),
          }),
        })
        // Third call: product items query [第三次调用：产品项查询]
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockItems),
          }),
        })
        // Second test call: product item query [第二次测试调用：产品项查询]
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProductItem]),
            }),
          }),
        })
        // Second test call: product query [第二次测试调用：产品查询]
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
              for: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockProduct]),
              }),
            }),
          }),
        })
        // Second test call: product items query [第二次测试调用：产品项查询]
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockItems),
          }),
        });

      // Act & Assert [执行与断言]
      // The service is called twice to verify both error code and message [服务被调用两次以验证错误代码和消息]
      await expect(service.removeItem(itemId)).rejects.toThrow(
        CatalogException,
      );
      await expect(service.removeItem(itemId)).rejects.toThrow(
        CATALOG_ERROR_MESSAGES.PRODUCT_MIN_ITEMS,
      );
    });
  });

  describe("search", () => {
    it("should return paginated products [应该返回分页产品]", async () => {
      // Arrange [准备]
      const filter: ProductFilterDto = {
        name: "test",
        status: ProductStatus.ACTIVE,
      };

      const pagination: PaginationDto = {
        page: 1,
        pageSize: 10,
      };

      const mockProducts = [generateMockProduct(), generateMockProduct()];
      const total = mockProducts.length;

      // Mock database to return products and count [模拟数据库返回产品和计数]
      const mockFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              offset: jest.fn().mockResolvedValue(mockProducts),
            }),
          }),
        }),
      });

      const mockCountFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ total }]),
      });

      // First call for count, second for data
      mockDb.select
        .mockReturnValueOnce({ from: mockCountFrom })
        .mockReturnValueOnce({ from: mockFrom });

      // Act [执行]
      const result = await service.search(filter, pagination);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(mockProducts.length);
      expect(result.total).toBe(total);
      expect(result.page).toBe(pagination.page);
      expect(result.pageSize).toBe(pagination.pageSize);
    });

    it("should return all products when no pagination provided [当没有提供分页时应该返回所有产品]", async () => {
      // Arrange [准备]
      const filter: ProductFilterDto = {
        name: "test",
      };

      const mockProducts = [generateMockProduct(), generateMockProduct()];
      const total = mockProducts.length;

      // Mock database to return products and count [模拟数据库返回产品和计数]
      const mockFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue(mockProducts),
        }),
      });

      const mockCountFrom = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ total }]),
      });

      // First call for count, second for data
      mockDb.select
        .mockReturnValueOnce({ from: mockCountFrom })
        .mockReturnValueOnce({ from: mockFrom });

      // Act [执行]
      const result = await service.search(filter);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(mockProducts.length);
      expect(result.total).toBe(total);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(total);
      expect(result.totalPages).toBe(1);
    });
  });

  describe("findOne", () => {
    it("should find product by id successfully [应该成功通过ID查找产品]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;

      const mockProductItems = Array.from({ length: 3 }, () =>
        generateMockProductItem(),
      );
      mockProductItems.forEach((item) => {
        item.productId = productId;
      });

      // Mock database to find product [模拟数据库查找产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
          }),
        }),
      });

      // Mock database to find product items [模拟数据库查找产品项]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockProductItems),
          }),
        }),
      });

      // Act [执行]
      const result = await service.findOne({ id: productId });

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.id).toBe(productId);
      expect(result.items).toHaveLength(3);
    });

    it("should return null when product is not found [当产品未找到时返回null]", async () => {
      // Arrange [准备]
      const productId = randomUUID();

      // Mock database operations [模拟数据库操作]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act [执行]
      const result = await service.findOne({ id: productId });

      // Assert [断言]
      expect(result).toBeNull();
    });
  });

  describe("publish", () => {
    it("should publish product successfully [应该成功发布产品]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.DRAFT;

      const publishedProduct = { ...mockProduct, status: ProductStatus.ACTIVE };

      // Create a consistent service type ID to use across all mocks
      const serviceTypeId = randomUUID();
      const itemId = randomUUID();
      
      // Reset all mocks
      jest.clearAllMocks();
      
      // Mock the transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        // Create a promise that resolves to product items array
        const productItemsPromise = Promise.resolve([{ id: itemId, serviceTypeId }]);
        
        // Mock database context with specific return values for each select call
        const mockTx = {
          select: jest.fn()
            // First call: get product with FOR UPDATE lock
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  for: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([mockProduct]),
                  }),
                }),
              }),
            })
            // Second call: check product has at least one item
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([{ id: itemId }]),
                }),
              }),
            })
            // Third call: get all product items - return a promise that resolves to array
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue(productItemsPromise),
              }),
            })
            // Fourth call: validate service types - return service type data
            .mockReturnValueOnce({
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  // Return array directly when awaited, no need for limit
                  then: jest.fn().mockImplementation((resolve) => {
                    resolve([{ id: serviceTypeId, status: 'ACTIVE' }]);
                    return Promise.resolve();
                  }),
                }),
              }),
            }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([publishedProduct]),
              }),
            }),
          }),
        };
        
        // Execute the callback with our mock transaction
        return callback(mockTx);
      });

      // Mock database update [模拟数据库更新]
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([publishedProduct]),
          }),
        }),
      });

      // Act [执行]
      const result = await service.publish(productId);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.id).toBe(productId);
      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(result.publishedAt).toBeDefined();
    });

    it("should throw exception when product is not found [当产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();

      // Mock database to return no product [模拟数据库返回无产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.publish(productId)).rejects.toThrow(
        new CatalogNotFoundException("PRODUCT_NOT_FOUND"),
      );
    });

    it("should throw exception when product is already published [当产品已发布时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.ACTIVE;

      // Mock database to find product [模拟数据库查找产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockProduct]),
            }),
          }),
        }),
      });

      // Mock database to find product items for findOne method
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
            for: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.publish(productId)).rejects.toThrow(
        new CatalogException(CATALOG_ERROR_MESSAGES.PRODUCT_ALREADY_PUBLISHED),
      );
    });
  });

  describe("unpublish", () => {
    it("should unpublish product successfully [应该成功取消发布产品]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.ACTIVE;

      const unpublishedProduct = {
        ...mockProduct,
        status: ProductStatus.INACTIVE,
      };

      // Mock database to find product [模拟数据库查找产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
          }),
        }),
      });

      // Mock database to find product items for findOne method
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock database update [模拟数据库更新]
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([unpublishedProduct]),
          }),
        }),
      });

      // Act [执行]
      const result = await service.unpublish(productId);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.id).toBe(productId);
      expect(result.status).toBe(ProductStatus.INACTIVE);
      expect(result.unpublishedAt).toBeDefined();
    });

    it("should throw exception when product is not found [当产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();

      // Mock database to return no product [模拟数据库返回无产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.unpublish(productId)).rejects.toThrow(
        new CatalogNotFoundException("PRODUCT_NOT_FOUND"),
      );
    });

    it("should throw exception when product is not published [当产品未发布时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID();
      const mockProduct = generateMockProduct();
      mockProduct.id = productId;
      mockProduct.status = ProductStatus.DRAFT;

      // Mock database to find product [模拟数据库查找产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
          }),
        }),
      });

      // Mock database to find product items for findOne method
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.unpublish(productId)).rejects.toThrow(
        new CatalogException(CATALOG_ERROR_MESSAGES.PRODUCT_NOT_PUBLISHED),
      );
    });
  });

  describe("revertToDraft", () => {
    it("should revert a published product to draft status successfully [应该成功将已发布的产品恢复为草稿状态]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.INACTIVE; // Should be INACTIVE for revertToDraft [应该是INACTIVE状态才能恢复为草稿]

      // Mock database to find existing product [模拟数据库查找已存在的产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingProduct]),
          }),
        }),
      });

      // Mock database to find product items for findOne method
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock database update [模拟数据库更新]
      const mockReturning = jest
        .fn()
        .mockResolvedValue([
          { ...existingProduct, status: ProductStatus.DRAFT },
        ]);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      });

      // Act [执行]
      const result = await service.revertToDraft(productId);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.status).toBe(ProductStatus.DRAFT);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw exception when product to revert is not found [当要恢复的产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]

      // Mock database operations [模拟数据库操作]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.revertToDraft(productId)).rejects.toThrow(
        new CatalogNotFoundException("PRODUCT_NOT_FOUND"),
      );
    });

    it("should throw exception when product is already in draft status [当产品已经是草稿状态时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.DRAFT;

      // Mock database to find existing product [模拟数据库查找已存在的产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingProduct]),
          }),
        }),
      });

      // Mock database to find product items for findOne method
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.revertToDraft(productId)).rejects.toThrow(
        new CatalogException(CATALOG_ERROR_MESSAGES.INVALID_STATUS_TRANSITION),
      );
    });
  });

  describe("createSnapshot", () => {
    it("should create product snapshot successfully [应该成功创建产品快照]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.ACTIVE;
      existingProduct.items = [generateMockProductItem()]; // Add items to product [为产品添加项]

      // Mock database to find existing product [模拟数据库查找已存在的产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingProduct]),
          }),
        }),
      });

      // Mock database to find product items [模拟数据库查找产品项]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([generateMockProductItem()]),
          }),
        }),
      });

      // Act [执行]
      const result = await service.createSnapshot(productId);

      // Assert [断言]
      expect(result).toBeDefined();
      expect(result.productId).toBe(productId);
      expect(result.productName).toBe(existingProduct.name);
      expect(result.productCode).toBe(existingProduct.code);
      expect(result.items).toHaveLength(1);
    });

    it("should throw exception when product to snapshot is not found [当要快照的产品未找到时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]

      // Mock database operations [模拟数据库操作]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.createSnapshot(productId)).rejects.toThrow(
        new CatalogNotFoundException("PRODUCT_NOT_FOUND"),
      );
    });

    it("should throw exception when product is not published [当产品未发布时抛出异常]", async () => {
      // Arrange [准备]
      const productId = randomUUID(); // Use randomUUID instead of faker [使用randomUUID替代faker]
      const existingProduct = generateMockProduct();
      existingProduct.id = productId;
      existingProduct.status = ProductStatus.DRAFT;
      existingProduct.items = []; // Add items to product [为产品添加项]

      // Mock database to find existing product [模拟数据库查找已存在的产品]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingProduct]),
          }),
        }),
      });

      // Mock database to find product items [模拟数据库查找产品项]
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act & Assert [执行与断言]
      await expect(service.createSnapshot(productId)).rejects.toThrow(
        new CatalogException("PRODUCT_NOT_PUBLISHED"),
      );
    });
  });

  describe("findOne", () => {
    it("should return product by ID", async () => {
      // Arrange
      const productId = randomUUID();
      const timestamp = Date.now();
      const mockProduct = {
        id: productId,
        name: `Product-${timestamp}`,
        code: `CODE-${timestamp}`,
        description: `Description for product ${timestamp}`,
        coverImage: `https://example.com/image-${timestamp}.jpg`,
        targetUserPersona: JSON.stringify(["UNDERGRADUATE"]),
        price: (Math.random() * 990 + 10).toFixed(2),
        currency: "USD",
        status: ProductStatus.ACTIVE,
        marketingLabels: JSON.stringify(["hot"]),
        metadata: JSON.stringify({ key: "value" }),
        createdBy: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        version: 1,
        items: [], // Add items property [添加items属性]
      };

      const mockItems = [
        {
          id: randomUUID(),
          productId: productId,
          serviceTypeId: randomUUID(),
          quantity: Math.floor(Math.random() * 10) + 1,
          sortOrder: 0,
        },
      ];

      const mockServiceTypes = [
        {
          id: mockItems[0].serviceTypeId,
          name: `Service-${timestamp}`,
          description: `Description for service ${timestamp}`,
          metadata: JSON.stringify({}),
        },
      ];

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockProduct]),
          }),
        }),
      });

      // Mock product items query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      // Mock service types query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(mockServiceTypes),
        }),
      });

      // Act
      const result: IProductDetail = await service.findOne({ id: productId });

      // Assert
      expect(result).toHaveProperty("id", productId);
      expect(result).toHaveProperty("items");
      expect(result.items).toHaveLength(1);
    });

    it("should return null if product not found", async () => {
      // Arrange
      const productId = randomUUID();

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act
      const result = await service.findOne({ id: productId });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("search", () => {
    it("should return paginated products", async () => {
      // Arrange
      const timestamp = Date.now();
      const productId = randomUUID();
      const mockProducts = [
        {
          id: productId,
          name: `Product-${timestamp}`,
          code: `CODE-${timestamp}`,
          description: `Description for product ${timestamp}`,
          coverImage: `https://example.com/image-${timestamp}.jpg`,
          targetUserPersona: JSON.stringify(["UNDERGRADUATE"]),
          price: (Math.random() * 990 + 10).toFixed(2),
          currency: "USD",
          status: ProductStatus.ACTIVE,
          marketingLabels: JSON.stringify(["hot"]),
          metadata: JSON.stringify({ key: "value" }),
          createdBy: randomUUID(),

          publishedAt: new Date(),
          version: 1,
        },
      ];

      const mockItems = [
        {
          id: randomUUID(),
          productId: productId,
          serviceTypeId: randomUUID(),
          quantity: Math.floor(Math.random() * 10) + 1,
          sortOrder: 0,
        },
      ];

      const _mockServiceTypes = [
        {
          id: mockItems[0].serviceTypeId,
          name: `Service-${timestamp}`,
          description: `Description for service ${timestamp}`,
          metadata: JSON.stringify({}),
        },
      ];

      // Mock count query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ total: 1 }]),
        }),
      });

      // Mock main query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      });

      // Act
      const result = await service.search({});

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("id");
      expect(result.data[0]).not.toHaveProperty("items");
    });

    it("should return all products when no pagination", async () => {
      // Arrange
      const timestamp = Date.now();
      const productId = randomUUID();
      const mockProducts = [
        {
          id: productId,
          name: `Product-${timestamp}`,
          code: `CODE-${timestamp}`,
          description: `Description for product ${timestamp}`,
          coverImage: `https://example.com/image-${timestamp}.jpg`,
          targetUserPersona: JSON.stringify(["UNDERGRADUATE"]),
          price: (Math.random() * 990 + 10).toFixed(2),
          currency: "USD",
          status: ProductStatus.ACTIVE,
          marketingLabels: JSON.stringify(["hot"]),
          metadata: JSON.stringify({ key: "value" }),
          createdBy: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: new Date(),
          version: 1,
        },
      ];

      const mockItems = [
        {
          id: randomUUID(),
          productId: productId,
          serviceTypeId: randomUUID(),
          quantity: Math.floor(Math.random() * 10) + 1,
          sortOrder: 0,
        },
      ];

      const _mockServiceTypes = [
        {
          id: mockItems[0].serviceTypeId,
          name: `Service-${timestamp}`,
          description: `Description for service ${timestamp}`,
          metadata: JSON.stringify({}),
        },
      ];

      // Mock count query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ total: 1 }]),
        }),
      });

      // Mock main query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      });

      // Act
      const result = await service.search({});

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("id");
      expect(result.data[0]).not.toHaveProperty("items");
    });
  });
});
