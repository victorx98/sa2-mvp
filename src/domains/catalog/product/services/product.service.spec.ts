import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ProductService } from "./product.service";
import { ServiceService } from "../../service/services/service.service";
import { ServicePackageService } from "../../service-package/services/service-package.service";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  createTestFixtures,
  TestFixtures,
} from "../../../../../test/utils/test-fixtures";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import {
  Currency,
  UserType,
  ProductItemType,
  ServiceUnit,
  ProductStatus,
} from "../../common/interfaces/enums";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

describe("ProductService (Integration with Real Database)", () => {
  let moduleRef: TestingModule;
  let service: ProductService;
  let _serviceService: ServiceService;
  let _servicePackageService: ServicePackageService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;
  let testUserId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
      ],
      providers: [ProductService, ServiceService, ServicePackageService],
    }).compile();

    service = moduleRef.get<ProductService>(ProductService);
    _serviceService = moduleRef.get<ServiceService>(ServiceService);
    _servicePackageService = moduleRef.get<ServicePackageService>(
      ServicePackageService,
    );
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);

    // Clean up any existing test data first
    await fixtures.cleanupAll();

    // Create test user
    const user = await fixtures.createUser();
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up all test data
    await fixtures.cleanupAll();

    await moduleRef.close();
  });

  afterEach(async () => {
    // Clean up catalog data after each test to avoid unique constraint violations
    await fixtures.cleanupAllCatalogData();
  });

  describe("create", () => {
    it("should successfully create a product in draft status", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });

      const createDto = {
        code: `vip_product_${Date.now()}`,
        name: "VIP Job Seeking Service",
        description: "One-stop job seeking service",
        price: 5999.0,
        currency: Currency.USD,
        validityDays: 365,
        targetUserTypes: [UserType.UNDERGRADUATE, UserType.GRADUATE],
        marketingLabels: ["hot", "recommended"] as any,
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 3,
            unit: ServiceUnit.TIMES,
            sortOrder: 0,
          },
        ],
      };

      const result = await service.create(createDto, testUserId);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe(createDto.code);
      expect(result.status).toBe(ProductStatus.DRAFT);
      expect(result.createdBy).toBe(testUserId);
      // Database returns decimal as string with 2 decimal places
      expect(parseFloat(result.price)).toBe(createDto.price);
    });

    it("should reject duplicate product code", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const code = `unique_product_${Date.now()}`;

      await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { code },
      );

      const createDto = {
        code,
        name: "Another Product",
        price: 999.0,
        currency: Currency.USD,
        validityDays: 365,
        targetUserTypes: [UserType.UNDERGRADUATE],
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogConflictException,
      );
    });

    it("should reject invalid price (negative)", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });

      const createDto = {
        code: `invalid_price_${Date.now()}`,
        name: "Invalid Product",
        price: -100.0,
        currency: Currency.USD,
        validityDays: 365,
        targetUserTypes: [UserType.UNDERGRADUATE],
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject invalid validity days (negative)", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });

      const createDto = {
        code: `invalid_validity_${Date.now()}`,
        name: "Invalid Product",
        price: 999.0,
        currency: Currency.USD,
        validityDays: -30,
        targetUserTypes: [UserType.UNDERGRADUATE],
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject referencing non-existent service", async () => {
      const createDto = {
        code: `invalid_ref_${Date.now()}`,
        name: "Invalid Product",
        price: 999.0,
        currency: Currency.USD,
        validityDays: 365,
        targetUserTypes: [UserType.UNDERGRADUATE],
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: "00000000-0000-0000-0000-000000000000",
            quantity: 1,
            unit: ServiceUnit.TIMES,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogNotFoundException,
      );
    });

    it("should reject referencing non-active service", async () => {
      const inactiveService = await fixtures.createService(testUserId, {
        status: "inactive",
      });

      const createDto = {
        code: `inactive_ref_${Date.now()}`,
        name: "Product with Inactive Service",
        price: 999.0,
        currency: Currency.USD,
        validityDays: 365,
        targetUserTypes: [UserType.UNDERGRADUATE],
        items: [
          {
            type: ProductItemType.SERVICE,
            referenceId: inactiveService.id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("update", () => {
    it("should successfully update unpublished draft product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        {
          name: "Original Name",
          status: "draft",
          publishedAt: null,
        },
      );

      const updateDto = {
        name: "Updated Product Name",
        price: 6999.0,
      };

      const result = await service.update(product.id, updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateDto.name);
      // Database returns decimal as string with 2 decimal places
      expect(parseFloat(result.price)).toBe(updateDto.price);
    });

    it("should reject updating published product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        {
          status: "draft",
          publishedAt: new Date(), // Already published before
        },
      );

      const updateDto = {
        name: "Updated Name",
      };

      await expect(service.update(product.id, updateDto)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject updating deleted product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "deleted" },
      );

      const updateDto = {
        name: "Updated Name",
      };

      await expect(service.update(product.id, updateDto)).rejects.toThrow(
        CatalogGoneException,
      );
    });

    it("should reject updating non-existent product", async () => {
      const updateDto = {
        name: "Updated Name",
      };

      await expect(
        service.update("00000000-0000-0000-0000-000000000000", updateDto),
      ).rejects.toThrow(CatalogNotFoundException);
    });
  });

  describe("addItem", () => {
    it("should successfully add service to draft product", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const addItemDto = {
        type: ProductItemType.SERVICE,
        referenceId: services[1].id,
        quantity: 5,
        unit: ServiceUnit.TIMES,
        sortOrder: 1,
      };

      await service.addItem(product.id, addItemDto);

      // Verify item was added
      const updatedProduct = await service.findOne({ id: product.id });
      expect(updatedProduct?.items?.length).toBe(2);
    });

    it("should validate service package quantity must be 1", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(testUserId, [
        services[0].id,
      ]);
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const addItemDto = {
        type: ProductItemType.SERVICE_PACKAGE,
        referenceId: servicePackage.id,
        quantity: 2, // Invalid: must be 1
        unit: ServiceUnit.TIMES,
        sortOrder: 1,
      };

      await expect(service.addItem(product.id, addItemDto)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject adding duplicate item", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const addItemDto = {
        type: ProductItemType.SERVICE,
        referenceId: services[0].id, // Already exists
        quantity: 1,
        unit: ServiceUnit.TIMES,
        sortOrder: 1,
      };

      await expect(service.addItem(product.id, addItemDto)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject adding item to non-draft product", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      ); // Not draft

      const addItemDto = {
        type: ProductItemType.SERVICE,
        referenceId: services[1].id,
        quantity: 1,
        unit: ServiceUnit.TIMES,
        sortOrder: 1,
      };

      await expect(service.addItem(product.id, addItemDto)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("removeItem", () => {
    it("should successfully remove item from product", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
          {
            type: ProductItemType.SERVICE,
            referenceId: services[1].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      // Get item ID
      const productWithItems = await service.findOne({ id: product.id });
      const itemToRemove = productWithItems?.items?.[1];

      if (itemToRemove) {
        await service.removeItem(product.id, itemToRemove.id);

        // Verify item was removed
        const updatedProduct = await service.findOne({ id: product.id });
        expect(updatedProduct?.items?.length).toBe(1);
      }
    });

    it("should reject removing last item", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      // Get item ID
      const productWithItems = await service.findOne({ id: product.id });
      const itemId = productWithItems?.items?.[0]?.id;

      if (itemId) {
        await expect(service.removeItem(product.id, itemId)).rejects.toThrow(
          CatalogException,
        );
      }
    });
  });

  describe("publish", () => {
    it("should successfully publish draft product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const result = await service.publish(product.id, {}, testUserId);

      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(result.publishedAt).toBeDefined();
      expect(result.publishedBy).toBe(testUserId);
    });

    it("should reject publishing non-draft product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      ); // Already published

      await expect(service.publish(product.id, {}, testUserId)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject publishing product without items", async () => {
      // Create product without items by directly inserting
      const timestamp = Date.now();
      const [emptyProduct] = await db
        .insert(schema.products)
        .values({
          code: `empty_${timestamp}`,
          name: "Empty Product",
          price: "999.00",
          currency: Currency.USD,
          validityDays: 365,
          targetUserTypes: [UserType.UNDERGRADUATE],
          status: "draft",
          sortOrder: 0,
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await expect(
        service.publish(emptyProduct.id, {}, testUserId),
      ).rejects.toThrow(CatalogException);
    });

    it("should support scheduled publishing", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const scheduledAt = new Date(Date.now() + 86400000); // Tomorrow
      const result = await service.publish(
        product.id,
        { publishAt: scheduledAt.toISOString() },
        testUserId,
      );

      expect(result.scheduledPublishAt).toBeDefined();
      expect(result.status).toBe(ProductStatus.DRAFT); // Still draft until scheduled time
    });
  });

  describe("unpublish", () => {
    it("should successfully unpublish active product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      );

      const reason = "Product needs update";
      const result = await service.unpublish(product.id, reason, testUserId);

      expect(result.status).toBe(ProductStatus.INACTIVE);
      expect(result.unpublishedAt).toBeDefined();
      expect(result.unpublishedBy).toBe(testUserId);
    });

    it("should require unpublish reason", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      );

      await expect(
        service.unpublish(product.id, "", testUserId),
      ).rejects.toThrow(CatalogException);
    });

    it("should reject unpublishing non-active product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      await expect(
        service.unpublish(product.id, "Reason", testUserId),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("revertToDraft", () => {
    it("should successfully revert inactive product to draft", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "inactive" },
      );

      const result = await service.revertToDraft(product.id);

      expect(result.status).toBe(ProductStatus.DRAFT);
    });

    it("should reject reverting non-inactive product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      );

      await expect(service.revertToDraft(product.id)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("remove", () => {
    it("should successfully delete unpublished draft product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft", publishedAt: null },
      );

      const result = await service.remove(product.id);

      expect(result.status).toBe(ProductStatus.DELETED);
    });

    it("should reject deleting published product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft", publishedAt: new Date() },
      );

      await expect(service.remove(product.id)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("restore", () => {
    it("should successfully restore deleted product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "deleted" },
      );

      const result = await service.restore(product.id);

      expect(result.status).toBe(ProductStatus.DRAFT);
    });

    it("should reject restoring non-deleted product", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const product = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      );

      await expect(service.restore(product.id)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("findOne", () => {
    it("should find product by ID with items", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const product = await fixtures.createProduct(testUserId, [
        {
          type: ProductItemType.SERVICE,
          referenceId: services[0].id,
          quantity: 1,
          unit: ServiceUnit.TIMES,
        },
        {
          type: ProductItemType.SERVICE,
          referenceId: services[1].id,
          quantity: 2,
          unit: ServiceUnit.TIMES,
        },
      ]);

      const result = await service.findOne({ id: product.id });

      expect(result).toBeDefined();
      expect(result?.id).toBe(product.id);
      expect(result?.items?.length).toBe(2);
    });

    it("should return null when product not found", async () => {
      const result = await service.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });
  });

  describe("search", () => {
    beforeAll(async () => {
      // Create multiple products for search testing
      const services = await fixtures.createServices(testUserId, 3, {
        status: "active",
      });
      for (let i = 0; i < 3; i++) {
        await fixtures.createProduct(
          testUserId,
          [
            {
              type: ProductItemType.SERVICE,
              referenceId: services[i].id,
              quantity: 1,
              unit: ServiceUnit.TIMES,
            },
          ],
          {
            status: i % 2 === 0 ? "draft" : "active",
          },
        );
      }
    });

    it("should search products with pagination", async () => {
      const filters = {};
      const pagination = { page: 1, pageSize: 2 };

      const result = await service.search(filters, pagination);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it("should filter products by status", async () => {
      const filters = { status: ProductStatus.ACTIVE };

      const result = await service.search(filters);

      expect(result.data.every((p) => p.status === ProductStatus.ACTIVE)).toBe(
        true,
      );
    });
  });

  describe("batchUpdate", () => {
    it("should successfully batch publish products", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const product1 = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const product2 = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[1].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const batchDto = {
        productIds: [product1.id, product2.id],
        operation: "publish" as const,
      };

      const result = await service.batchUpdate(batchDto, testUserId);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle partial failures in batch operation", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const draftProduct = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[0].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "draft" },
      );

      const activeProduct = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: services[1].id,
            quantity: 1,
            unit: ServiceUnit.TIMES,
          },
        ],
        { status: "active" },
      ); // Cannot publish again

      const batchDto = {
        productIds: [draftProduct.id, activeProduct.id],
        operation: "publish" as const,
      };

      const result = await service.batchUpdate(batchDto, testUserId);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].productId).toBe(activeProduct.id);
    });
  });

  describe("updateSortOrder", () => {
    it("should successfully update product sort order", async () => {
      const services = await fixtures.createServices(testUserId, 3, {
        status: "active",
      });
      const products = await Promise.all([
        fixtures.createProduct(
          testUserId,
          [
            {
              type: ProductItemType.SERVICE,
              referenceId: services[0].id,
              quantity: 1,
              unit: ServiceUnit.TIMES,
            },
          ],
          { sortOrder: 0 },
        ),
        fixtures.createProduct(
          testUserId,
          [
            {
              type: ProductItemType.SERVICE,
              referenceId: services[1].id,
              quantity: 1,
              unit: ServiceUnit.TIMES,
            },
          ],
          { sortOrder: 1 },
        ),
        fixtures.createProduct(
          testUserId,
          [
            {
              type: ProductItemType.SERVICE,
              referenceId: services[2].id,
              quantity: 1,
              unit: ServiceUnit.TIMES,
            },
          ],
          { sortOrder: 2 },
        ),
      ]);

      const updates = [
        { productId: products[0].id, sortOrder: 2 },
        { productId: products[1].id, sortOrder: 0 },
        { productId: products[2].id, sortOrder: 1 },
      ];

      await service.updateProductSortOrder(updates);

      // Verify sort order was updated
      const updatedProduct = await service.findOne({ id: products[0].id });
      expect(updatedProduct?.sortOrder).toBe(2);
    });
  });
});
