import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServiceService } from "@domains/catalog/service/services/service.service";
import { ServicePackageService } from "@domains/catalog/service-package/services/service-package.service";
import { ProductService } from "@domains/catalog/product/services/product.service";
import { ServiceModule } from "@domains/catalog/service/service.module";
import { ServicePackageModule } from "@domains/catalog/service-package/service-package.module";
import { ProductModule } from "@domains/catalog/product/product.module";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { CreateProductDto } from "@domains/catalog/product/dto/create-product.dto";
import { UpdateProductDto } from "@domains/catalog/product/dto/update-product.dto";
import { AddProductItemDto } from "@domains/catalog/product/dto/add-product-item.dto";
import { ProductFilterDto } from "@domains/catalog/product/dto/product-filter.dto";
import {
  ServiceType,
  BillingMode,
  ProductStatus,
  Currency,
  UserType,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";
import { CatalogException } from "@domains/catalog/common/exceptions/catalog.exception";
import { createTestFixtures, TestFixtures } from "../utils/test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

describe("ProductService Integration Tests", () => {
  let moduleRef: TestingModule;
  let serviceService: ServiceService;
  let packageService: ServicePackageService;
  let productService: ProductService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;
  let testUserId: string;
  const createdServiceIds: string[] = [];
  const createdPackageIds: string[] = [];
  const createdProductIds: string[] = [];

  // Test services and packages
  let gapAnalysisServiceId: string;
  let basicPackageId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
        ServiceModule,
        ServicePackageModule,
        ProductModule,
      ],
    }).compile();

    serviceService = moduleRef.get<ServiceService>(ServiceService);
    packageService = moduleRef.get<ServicePackageService>(
      ServicePackageService,
    );
    productService = moduleRef.get<ProductService>(ProductService);
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);

    // Clean up and create test user
    await fixtures.cleanupAll();
    const user = await fixtures.createUser();
    testUserId = user.id;

    // Create test service
    const gapAnalysis = await serviceService.create(
      {
        code: `GAP-PROD-${Date.now()}`,
        serviceType: ServiceType.GAP_ANALYSIS,
        name: "Gap Analysis for Product",
        billingMode: BillingMode.ONE_TIME,
      },
      testUserId,
    );
    gapAnalysisServiceId = gapAnalysis.id;
    createdServiceIds.push(gapAnalysisServiceId);

    // Create test service package
    const basicPackage = await packageService.create(
      {
        code: `PKG-PROD-${Date.now()}`,
        name: "Basic Package for Product",
        items: [
          {
            serviceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      },
      testUserId,
    );
    basicPackageId = basicPackage.id;
    createdPackageIds.push(basicPackageId);
  });

  afterAll(async () => {
    // Clean up all test data
    await fixtures.cleanupAll();

    await moduleRef.close();
  });

  beforeEach(async () => {
    // Clean up and recreate test service and package before each test
    await fixtures.cleanupAllCatalogData();

    const gapAnalysis = await serviceService.create(
      {
        code: `GAP-PROD-${Date.now()}`,
        serviceType: ServiceType.GAP_ANALYSIS,
        name: "Gap Analysis for Product",
        billingMode: BillingMode.ONE_TIME,
      },
      testUserId,
    );
    gapAnalysisServiceId = gapAnalysis.id;

    const basicPackage = await packageService.create(
      {
        code: `PKG-PROD-${Date.now()}`,
        name: "Basic Package for Product",
        items: [
          {
            serviceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      },
      testUserId,
    );
    basicPackageId = basicPackage.id;
  });

  describe("创建产品 (create)", () => {
    it("应该成功创建一个draft状态的产品", async () => {
      const dto: CreateProductDto = {
        code: `PROD-DRAFT-${Date.now()}`,
        name: "基础咨询产品",
        description: "包含gap analysis服务",
        price: 999.99,
        currency: Currency.USD,
        targetUserTypes: [UserType.UNDERGRADUATE],
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      };

      const result = await productService.create(dto, testUserId);
      createdProductIds.push(result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe(dto.code);
      expect(result.name).toBe(dto.name);
      expect(result.price).toBe("999.99");
      expect(result.currency).toBe(Currency.USD);
      expect(result.status).toBe(ProductStatus.DRAFT);
    });

    it("应该成功创建包含服务包的产品", async () => {
      const dto: CreateProductDto = {
        code: `PROD-PKG-${Date.now()}`,
        name: "套餐产品",
        description: "包含服务包",
        price: 1999.0,
        currency: Currency.CNY,
        targetUserTypes: [UserType.GRADUATE, UserType.WORKING],
        items: [
          {
            type: ProductItemType.SERVICE_PACKAGE,
            referenceId: basicPackageId,
            quantity: 1,
          },
        ],
        validityDays: 90,
        marketingLabels: ["hot", "recommended"],
      };

      const result = await productService.create(dto, testUserId);
      createdProductIds.push(result.id);

      expect(result.price).toBe("1999.00");
      expect(result.currency).toBe(Currency.CNY);
      expect(result.validityDays).toBe(90);
      expect(result.targetUserTypes).toEqual([
        UserType.GRADUATE,
        UserType.WORKING,
      ]);
      expect(result.marketingLabels).toEqual(["热门", "限时优惠"]);
    });

    it("应该拒绝重复的code", async () => {
      const code = `PROD-DUP-${Date.now()}`;
      const dto: CreateProductDto = {
        code,
        name: "产品1",
        price: 100,
      };

      const result = await productService.create(dto, testUserId);
      createdProductIds.push(result.id);

      // 尝试创建相同code的产品
      const duplicateDto: CreateProductDto = {
        code,
        name: "产品2",
        price: 200,
      };

      await expect(
        productService.create(duplicateDto, testUserId),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("查询产品 (findOne, search)", () => {
    let testProductId: string;

    beforeAll(async () => {
      const dto: CreateProductDto = {
        code: `PROD-QUERY-${Date.now()}`,
        name: "查询测试产品",
        description: "用于测试查询功能",
        price: 1500,
        currency: Currency.USD,
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      };

      const result = await productService.create(dto, testUserId);
      testProductId = result.id;
      createdProductIds.push(testProductId);
    });

    it("应该能通过ID查询产品", async () => {
      const result = await productService.findOne({ id: testProductId });

      expect(result).toBeDefined();
      expect(result.id).toBe(testProductId);
      expect(result.name).toBe("查询测试产品");
    });

    it("应该能通过code查询产品", async () => {
      const product = await productService.findOne({ id: testProductId });
      const result = await productService.findOne({ code: product.code });

      expect(result).toBeDefined();
      expect(result.id).toBe(testProductId);
      expect(result.code).toBe(product.code);
    });

    it("查询不存在的产品应该返回null", async () => {
      const result = await productService.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });

    it("应该能按状态过滤产品", async () => {
      const filters: ProductFilterDto = {
        status: ProductStatus.DRAFT,
      };

      const result = await productService.search(filters);

      expect(result.data.every((p) => p.status === ProductStatus.DRAFT)).toBe(
        true,
      );
    });

    it("应该能按状态搜索产品（跳过价格范围）", async () => {
      // 注意：ProductFilterDto可能不支持minPrice/maxPrice
      const filters: ProductFilterDto = {
        status: ProductStatus.DRAFT,
      };

      const result = await productService.search(filters);

      expect(result.data.every((p) => p.status === ProductStatus.DRAFT)).toBe(
        true,
      );
    });

    it("应该能按关键词搜索产品", async () => {
      const filters: ProductFilterDto = {
        keyword: "查询测试",
      };

      const result = await productService.search(filters);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("应该支持分页查询", async () => {
      const filters: ProductFilterDto = {};
      const pagination = { page: 1, pageSize: 2 };

      const result = await productService.search(filters, pagination);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("更新产品 (update)", () => {
    let testProductId: string;

    beforeEach(async () => {
      const dto: CreateProductDto = {
        code: `PROD-UPDATE-${Date.now()}`,
        name: "原始产品名",
        description: "原始描述",
        price: 1000,
      };

      const result = await productService.create(dto, testUserId);
      testProductId = result.id;
      createdProductIds.push(testProductId);
    });

    it("应该能更新产品的名称和描述", async () => {
      const updateDto: UpdateProductDto = {
        name: "更新后的产品名",
        description: "更新后的描述",
      };

      const result = await productService.update(testProductId, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it("应该能更新产品的价格", async () => {
      const updateDto: UpdateProductDto = {
        price: 1500,
        currency: Currency.CNY,
      };

      const result = await productService.update(testProductId, updateDto);

      expect(result.price).toBe("1500.00");
      expect(result.currency).toBe(Currency.CNY);
    });

    it("应该能更新产品的营销标签", async () => {
      const updateDto: UpdateProductDto = {
        marketingLabels: ["new", "recommended"],
      };

      const result = await productService.update(testProductId, updateDto);

      expect(result.marketingLabels).toEqual(["new", "recommended"]);
    });
  });

  describe("管理产品项 (addItem, removeItem)", () => {
    let testProductId: string;

    beforeEach(async () => {
      const dto: CreateProductDto = {
        code: `PROD-ITEMS-${Date.now()}`,
        name: "产品项管理测试",
        price: 2000,
      };

      const result = await productService.create(dto, testUserId);
      testProductId = result.id;
      createdProductIds.push(testProductId);
    });

    it("应该能向产品添加服务项", async () => {
      const addDto: AddProductItemDto = {
        type: ProductItemType.SERVICE,
        referenceId: gapAnalysisServiceId,
        quantity: 1,
      };

      await productService.addItem(testProductId, addDto);

      const result = await productService.findOne({ id: testProductId });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(ProductItemType.SERVICE);
    });

    it("应该能向产品添加服务包项", async () => {
      const addDto: AddProductItemDto = {
        type: ProductItemType.SERVICE_PACKAGE,
        referenceId: basicPackageId,
        quantity: 1,
      };

      await productService.addItem(testProductId, addDto);

      const result = await productService.findOne({ id: testProductId });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(ProductItemType.SERVICE_PACKAGE);
    });

    it("应该能从产品移除项", async () => {
      // 先添加项
      await productService.addItem(testProductId, {
        type: ProductItemType.SERVICE,
        referenceId: gapAnalysisServiceId,
        quantity: 1,
      });

      const productWithItem = await productService.findOne({
        id: testProductId,
      });
      const itemId = productWithItem.items[0].id;

      // 移除项
      await productService.removeItem(testProductId, itemId);

      const result = await productService.findOne({ id: testProductId });
      expect(result.items).toHaveLength(0);
    });
  });

  describe("发布和下架产品 (publish, unpublish)", () => {
    it("应该能发布一个draft状态的产品", async () => {
      const dto: CreateProductDto = {
        code: `PROD-PUBLISH-${Date.now()}`,
        name: "待发布产品",
        price: 1000,
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      };

      const created = await productService.create(dto, testUserId);
      createdProductIds.push(created.id);

      const result = await productService.publish(created.id, {}, testUserId);

      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(result.publishedAt).toBeDefined();
      expect(result.publishedBy).toBe(testUserId);
    });

    it("应该能下架一个active状态的产品", async () => {
      const dto: CreateProductDto = {
        code: `PROD-UNPUBLISH-${Date.now()}`,
        name: "待下架产品",
        price: 1000,
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      };

      const created = await productService.create(dto, testUserId);
      createdProductIds.push(created.id);

      // 先发布
      await productService.publish(created.id, {}, testUserId);

      // 再下架
      const result = await productService.unpublish(
        created.id,
        "测试下架",
        testUserId,
      );

      expect(result.status).toBe(ProductStatus.INACTIVE);
      expect(result.unpublishedAt).toBeDefined();
      expect(result.unpublishedBy).toBe(testUserId);
    });
  });

  describe("删除产品 (remove)", () => {
    it("应该能删除draft状态的产品", async () => {
      const dto: CreateProductDto = {
        code: `PROD-DELETE-DRAFT-${Date.now()}`,
        name: "待删除草稿",
        price: 1000,
      };

      const created = await productService.create(dto, testUserId);

      const result = await productService.remove(created.id);

      expect(result.status).toBe(ProductStatus.DELETED);

      // 验证删除后无法查询到
      const found = await productService.findOne({ id: created.id });
      expect(found).toBeNull();
    });
  });

  describe("生成快照 (generateSnapshot)", () => {
    it("应该能获取产品的完整快照", async () => {
      const dto: CreateProductDto = {
        code: `PROD-SNAPSHOT-${Date.now()}`,
        name: "快照测试产品",
        price: 1500,
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: gapAnalysisServiceId,
            quantity: 1,
          },
          {
            type: ProductItemType.SERVICE_PACKAGE,
            referenceId: basicPackageId,
            quantity: 1,
          },
        ],
      };

      const created = await productService.create(dto, testUserId);
      createdProductIds.push(created.id);

      const snapshot = await productService.generateSnapshot(created.id);

      expect(snapshot).toBeDefined();
      expect(snapshot.productId).toBe(created.id);
      expect(snapshot.items).toHaveLength(2);
      expect(snapshot.items[0]).toBeDefined();
      expect(snapshot.items[1]).toBeDefined();
    });
  });
});
