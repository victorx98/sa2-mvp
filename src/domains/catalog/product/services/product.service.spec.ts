import { Test, TestingModule } from "@nestjs/testing";
import { ProductService } from "./product.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { CreateProductDto } from "../dto/create-product.dto";
import { UpdateProductDto } from "../dto/update-product.dto";
import { AddProductItemDto } from "../dto/add-product-item.dto";
import { ProductFilterDto } from "../dto/product-filter.dto";
import { FindOneProductDto } from "../dto/find-one-product.dto";
import { SortDto } from "../../common/dto/sort.dto";
import { ProductStatus, Currency } from "@shared/types/catalog-enums";
import { randomUUID } from "crypto";

// Define a type that includes the then method to make it awaitable
type MockQuery = {
  insert: jest.Mock<any, any, any>;
  values: jest.Mock<any, any, any>;
  select: jest.Mock<any, any, any>;
  from: jest.Mock<any, any, any>;
  where: jest.Mock<any, any, any>;
  limit: jest.Mock<any, any, any>;
  orderBy: jest.Mock<any, any, any>;
  offset: jest.Mock<any, any, any>;
  returning: jest.Mock<any, any, any>;
  update: jest.Mock<any, any, any>;
  set: jest.Mock<any, any, any>;
  delete: jest.Mock<any, any, any>;
  for: jest.Mock<any, any, any>;
  execute: jest.Mock<any, any, any>;
  then?: jest.Mock<any, any, any>;
};

// Mock database connection with proper chaining
const createMockQuery = (): any => {
  const mockQuery: MockQuery = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    for: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
  };

  return mockQuery;
};

// Helper function to mock the getOrderBy method
const mockGetOrderBy = () => {
  // Mock the getOrderBy method to return a simple SQL expression
  jest
    .spyOn(ProductService.prototype as any, "getOrderBy")
    .mockReturnValue("createdAt DESC");
};

const mockDb = {
  transaction: jest.fn(),
  insert: jest.fn(() => createMockQuery()),
  select: jest.fn(() => createMockQuery()),
  update: jest.fn(() => createMockQuery()),
  delete: jest.fn(() => createMockQuery()),
  eq: jest.fn((a, b) => ({ eq: true, a, b })),
  and: jest.fn((...args) => ({ and: true, args })),
  like: jest.fn((a, b) => ({ like: true, a, b })),
  ne: jest.fn((a, b) => ({ ne: true, a, b })),
  count: jest.fn(() => ({ count: true })),
  sql: jest.fn((template, ...args) => ({ sql: true, template, args })),
  inArray: jest.fn((a, b) => ({ inArray: true, a, b })),
  schema: {
    products: {
      id: "id",
      name: "name",
      code: "code",
      description: "description",
      coverImage: "coverImage",
      targetUserPersona: "targetUserPersona",
      price: "price",
      currency: "currency",
      marketingLabels: "marketingLabels",
      status: "status",
      publishedAt: "publishedAt",
      unpublishedAt: "unpublishedAt",
      metadata: "metadata",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      createdBy: "createdBy",
    },
    productItems: {
      id: "id",
      productId: "productId",
      serviceTypeId: "serviceTypeId",
      quantity: "quantity",
      sortOrder: "sortOrder",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    serviceTypes: {
      id: "id",
      code: "code",
      name: "name",
      description: "description",
      status: "status",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
};

// Generate mock product
const generateMockProduct = (overrides: any = {}) => ({
  id: randomUUID(),
  name: `Test Product ${Math.floor(Math.random() * 1000)}`,
  code: `PROD-${Math.floor(Math.random() * 1000)}`,
  description: `Test description for product`,
  coverImage: `https://example.com/test-image-${Math.floor(Math.random() * 1000)}.jpg`,
  targetUserPersona: ["undergraduate"],
  price: "1000.00",
  currency: "USD",
  marketingLabels: ["hot"],
  status: ProductStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: randomUUID(),
  ...overrides,
});

// Generate mock product item
const generateMockProductItem = (overrides: any = {}) => ({
  id: randomUUID(),
  productId: randomUUID(),
  serviceTypeId: randomUUID(),
  quantity: Math.floor(Math.random() * 10) + 1,
  sortOrder: Math.floor(Math.random() * 100),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ProductService", () => {
  let service: ProductService;
  let mockDatabase: any;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

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
    mockDatabase = module.get<any>(DATABASE_CONNECTION);
  });

  describe("create", () => {
    it("should create a product successfully [应该成功创建产品]", async () => {
      // Arrange
      const createDto: CreateProductDto = {
        name: "Test Product",
        code: "TEST-PROD-001",
        description: "Test product description",
        price: 1000.0,
        currency: Currency.USD,
      };
      const userId = randomUUID();
      const mockProduct = generateMockProduct({
        name: createDto.name,
        code: createDto.code,
        description: createDto.description,
      });

      // Mock database calls
      mockDatabase.transaction.mockImplementation(async (cb: any) => {
        // Mock product check
        const mockSelectQuery = createMockQuery();
        mockSelectQuery.limit.mockResolvedValue([]);
        mockDatabase.select.mockReturnValue(mockSelectQuery);

        // Mock product insert
        const mockInsertQuery = createMockQuery();
        mockInsertQuery.returning.mockResolvedValue([mockProduct]);
        mockDatabase.insert.mockReturnValue(mockInsertQuery);

        return cb(mockDatabase);
      });

      // Act
      const result = await service.create(createDto, userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(result.code).toBe(createDto.code);
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("should return products with items successfully [应该成功返回包含产品项的产品列表]", async () => {
      // Arrange
      const filter: ProductFilterDto = {};
      const pagination = { page: 1, pageSize: 10 };
      const sort: SortDto = { orderField: "createdAt", orderDirection: "desc" };

      const mockProduct = generateMockProduct();
      const mockProductItem = generateMockProductItem({
        productId: mockProduct.id,
      });

      // Mock the getOrderBy method
      mockGetOrderBy();

      // Mock database calls
      let selectCallCount = 0;
      mockDatabase.select.mockImplementation((selection: any) => {
        selectCallCount++;
        const mockQuery = createMockQuery();

        // Mock total count query
        if (selection && selection.total) {
          // This is the count query, it should return [{ total: 1 }] when awaited
          mockQuery.then = jest.fn(function (resolve) {
            return Promise.resolve([{ total: 1 }]).then(resolve);
          });
        }
        // Mock products list query
        else if (selectCallCount === 2) {
          // This is the products query with pagination, it should return [mockProduct] when awaited
          mockQuery.then = jest.fn(function (resolve) {
            return Promise.resolve([mockProduct]).then(resolve);
          });
        }
        // Mock product items query
        else {
          // This is the product items query for a specific product, it should return [mockProductItem] when awaited
          mockQuery.then = jest.fn(function (resolve) {
            return Promise.resolve([mockProductItem]).then(resolve);
          });
        }

        return mockQuery;
      });

      // Act
      const result = await service.search(filter, pagination, sort);

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].items).toBeDefined();
      expect(result.data[0].items).toHaveLength(1);
    });
  });

  describe("findOne", () => {
    it("should find a product by id successfully [应该成功通过ID查找产品]", async () => {
      // Arrange
      const productId = randomUUID();
      const findDto: FindOneProductDto = { id: productId };
      const mockProduct = generateMockProduct({ id: productId });
      const mockProductItem = generateMockProductItem({ productId });

      // Mock database calls
      mockDatabase.select.mockImplementation(() => {
        const mockQuery = createMockQuery();

        // Mock product query
        if (mockDatabase.select.mock.calls.length === 1) {
          mockQuery.limit.mockResolvedValue([mockProduct]);
        }
        // Mock product items query
        else {
          mockQuery.orderBy.mockResolvedValue([mockProductItem]);
        }

        return mockQuery;
      });

      // Act
      const result = await service.findOne(findDto);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(productId);
      expect(result?.items).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should update a product successfully [应该成功更新产品]", async () => {
      // Arrange
      const productId = randomUUID();
      const updateDto: UpdateProductDto = {
        name: "Updated Product Name",
      };
      const mockProduct = generateMockProduct({ id: productId });

      // Mock database calls
      mockDatabase.transaction.mockImplementation(async (cb: any) => {
        // Mock product check
        const mockSelectQuery = createMockQuery();
        mockSelectQuery.limit.mockResolvedValue([mockProduct]);
        mockDatabase.select.mockReturnValue(mockSelectQuery);

        // Mock product update
        const mockUpdateQuery = createMockQuery();
        mockUpdateQuery.returning.mockResolvedValue([mockProduct]);
        mockDatabase.update.mockReturnValue(mockUpdateQuery);

        return cb(mockDatabase);
      });

      // Act
      const userId = randomUUID(); // Mock user ID for testing [模拟测试用的用户ID]
      const result = await service.update(productId, updateDto, userId);

      // Assert
      expect(result).toBeDefined();
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("should update product status successfully [应该成功更新产品状态]", async () => {
      // Arrange
      const productId = randomUUID();
      const targetStatus = ProductStatus.ACTIVE;
      const mockProduct = generateMockProduct({
        id: productId,
        status: ProductStatus.DRAFT,
      });
      const updatedProduct = {
        ...mockProduct,
        status: targetStatus,
        publishedAt: new Date(),
      };
      const serviceTypeId = randomUUID();
      const mockProductItems = [
        {
          id: "item1",
          serviceTypeId,
          quantity: 1,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const mockServiceTypes = [{ id: serviceTypeId, status: "ACTIVE" }];

      // Mock database transaction
      mockDatabase.transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          for: jest.fn().mockReturnThis(),
          limit: jest.fn().mockImplementation(function () {
            // First select: get product with lock
            if (mockTx.select.mock.calls.length === 1) {
              return Promise.resolve([mockProduct]);
            }
            return this;
          }),
          orderBy: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          returning: jest.fn().mockImplementation(function () {
            return Promise.resolve([updatedProduct]);
          }),
          then: jest.fn(function (resolve: any) {
            // Second select: get product items
            if (
              mockTx.from.mock.calls.length === 1 &&
              mockTx.where.mock.calls.length === 1
            ) {
              return Promise.resolve(mockProductItems).then(resolve);
            }
            // Third select: get service types
            if (
              mockTx.from.mock.calls.length === 2 &&
              mockTx.where.mock.calls.length === 2
            ) {
              return Promise.resolve(mockServiceTypes).then(resolve);
            }
            return Promise.resolve([]).then(resolve);
          }),
        };

        return cb(mockTx);
      });

      // Act
      const result = await service.updateStatus(productId, targetStatus);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(targetStatus);
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });
  });

  describe("createSnapshot", () => {
    it("should create a product snapshot successfully [应该成功创建产品快照]", async () => {
      // Arrange
      const productId = randomUUID();
      const mockProduct = generateMockProduct({
        id: productId,
        status: ProductStatus.ACTIVE,
      });
      const serviceTypeId = randomUUID();
      const mockProductItem = generateMockProductItem({
        productId,
        serviceTypeId,
      });
      const mockServiceType = { id: serviceTypeId, code: "ST-001" };

      // Mock database calls
      let selectCallCount = 0;
      mockDatabase.select.mockImplementation(() => {
        selectCallCount++;
        const mockQuery = createMockQuery();

        // Mock product query
        if (selectCallCount === 1) {
          // Return product when awaited
          mockQuery.then = jest.fn(function (resolve) {
            return Promise.resolve([mockProduct]).then(resolve);
          });
        }
        // Mock product items query
        else if (selectCallCount === 2) {
          // Return product items when awaited
          mockQuery.then = jest.fn(function (resolve) {
            return Promise.resolve([mockProductItem]).then(resolve);
          });
        }
        // Mock service types query
        else {
          // Return service types array when awaited
          mockQuery.then = jest.fn(function (resolve) {
            return Promise.resolve([mockServiceType]).then(resolve);
          });
        }

        return mockQuery;
      });

      // Act
      const result = await service.createSnapshot(productId);

      // Assert
      expect(result).toBeDefined();
      expect(result.productId).toBe(productId);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("addItem", () => {
    it("should add a product item successfully [应该成功添加产品项]", async () => {
      // Arrange
      const productId = randomUUID();
      const serviceTypeId = randomUUID();
      const addItemDto: AddProductItemDto = {
        serviceTypeId,
        quantity: 5,
      };
      const mockProduct = generateMockProduct({
        id: productId,
        status: ProductStatus.DRAFT,
      });
      const mockServiceType = { id: serviceTypeId, status: "ACTIVE" };

      // Mock database calls
      mockDatabase.transaction.mockImplementation(async (cb: any) => {
        // Create a mock transaction object that will be passed to the callback
        const mockTx = {
          select: jest.fn(() => {
            const mockQuery = createMockQuery();

            // Mock product check with row lock
            if (mockTx.select.mock.calls.length === 1) {
              mockQuery.for.mockReturnThis();
              // Return product when awaited
              mockQuery.then = jest.fn(function (resolve) {
                return Promise.resolve([mockProduct]).then(resolve);
              });
            }
            // Mock service types check
            else if (mockTx.select.mock.calls.length === 2) {
              // Return service type array when awaited
              mockQuery.then = jest.fn(function (resolve) {
                return Promise.resolve([mockServiceType]).then(resolve);
              });
            }
            // Mock product items check
            else {
              // Return empty array when awaited (no existing items)
              mockQuery.then = jest.fn(function (resolve) {
                return Promise.resolve([]).then(resolve);
              });
            }

            return mockQuery;
          }),
          insert: jest.fn(() => {
            const mockQuery = createMockQuery();
            // Return nothing when awaited (insert successful)
            mockQuery.then = jest.fn(function (resolve) {
              return Promise.resolve([]).then(resolve);
            });
            return mockQuery;
          }),
        };

        return cb(mockTx);
      });

      // Act
      await service.addItem(productId, addItemDto);

      // Assert
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });
  });

  describe("removeItem", () => {
    it("should remove a product item successfully [应该成功移除产品项]", async () => {
      // Arrange
      const productId = randomUUID();
      const itemId = randomUUID();
      const mockProduct = generateMockProduct({
        id: productId,
        status: ProductStatus.DRAFT,
      });
      const mockProductItem = { productId: productId };

      // Track if delete was called in transaction
      let deleteCalled = false;

      // Mock database calls
      mockDatabase.transaction.mockImplementation(async (cb: any) => {
        // Create a mock transaction object that will be passed to the callback
        const mockTx = {
          select: jest.fn(() => {
            const mockQuery = createMockQuery();

            // Mock product item query
            if (mockTx.select.mock.calls.length === 1) {
              mockQuery.limit.mockResolvedValue([mockProductItem]);
            }
            // Mock product check
            else if (mockTx.select.mock.calls.length === 2) {
              mockQuery.for.mockReturnThis();
              mockQuery.limit.mockResolvedValue([mockProduct]);
            }
            // Mock product items count check
            else {
              mockQuery.execute.mockResolvedValue([{ count: 2 }]);
            }

            return mockQuery;
          }),
          delete: jest.fn(() => {
            deleteCalled = true;
            const mockQuery = createMockQuery();
            return mockQuery;
          }),
        };

        return cb(mockTx);
      });

      // Act
      await service.removeItem(itemId);

      // Assert
      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(deleteCalled).toBe(true);
    });
  });
});
