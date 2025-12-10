import { ProductService } from "@domains/catalog/product/services/product.service";
import { TestDatabaseHelper, createTestDatabaseHelper } from "../../../test/utils/test-database.helper";
import * as schema from "@infrastructure/database/schema";
import { CatalogException } from "@domains/catalog/common/exceptions/catalog.exception";
import { Currency } from "@shared/types/catalog-enums";
import { randomUUID } from "crypto";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { IProductDetail } from "@domains/catalog/product/interfaces";

describe("ProductService Integration Tests [ProductService集成测试]", () => {
  let productService: ProductService;
  let db: NodePgDatabase<typeof schema>;
  let testServiceTypeId1: string;
  let testServiceTypeId2: string;
  let testDatabaseHelper: TestDatabaseHelper;

  beforeAll(async () => {
    // Initialize test database connection
    testDatabaseHelper = await createTestDatabaseHelper();
    db = testDatabaseHelper.getDatabase();

    productService = new ProductService(db);
    console.log("✅ Test database setup complete [测试数据库设置完成]");
  }, 30000);

  beforeEach(async () => {
    // Query existing service types (do not create new data) [查询已存在的服务类型（不创建新数据）]
    console.log("🔍 Querying existing service types...");

    // Query existing service types [查询已存在的服务类型]
    const serviceTypes = await db
      .select()
      .from(schema.serviceTypes)
      .where(eq(schema.serviceTypes.status, "ACTIVE"))
      .limit(2);

    if (serviceTypes.length < 2) {
      throw new Error("At least 2 active service types are required for testing. Please ensure they exist.");
    }

    testServiceTypeId1 = serviceTypes[0].id;
    testServiceTypeId2 = serviceTypes[1].id;

    console.log("✅ Found service types:", {
      serviceType1: testServiceTypeId1,
      serviceType2: testServiceTypeId2,
    });
  }, 30000);

  describe("Product Creation and Publishing Flow [产品创建和发布流程]", () => {
    it("should successfully create and publish a product with multiple items [应该成功创建并发布包含多个项的产品]", async () => {
      // Arrange [准备]
      const userId = randomUUID();
      const createProductDto = {
        name: "Integration Test Product",
        code: `INTEGRATION-PRODUCT-${Date.now()}`,
        price: 299.99,
        currency: Currency.USD,
        metadata: {
          features: ["Feature 1", "Feature 2"],
          faqs: [{ question: "Q1", answer: "A1" }],
          duration: "3 months",
        },
        items: [
          {
            serviceTypeId: testServiceTypeId1,
            quantity: 5,
            sortOrder: 0,
          },
          {
            serviceTypeId: testServiceTypeId2,
            quantity: 10,
            sortOrder: 1,
          },
        ],
      };

      // Act [执行]
      console.log("Creating product with multiple items...");
      const createdProductId = (await productService.create(createProductDto, userId)).id;

      // Get full product detail with items
      const createdProduct = await productService.findOne({ id: createdProductId }) as IProductDetail;

      // Assert [断言]
      expect(createdProduct).toBeDefined();
      expect(createdProduct.id).toBeDefined();
      expect(createdProduct.name).toBe(createProductDto.name);
      expect(createdProduct.code).toBe(createProductDto.code);
      expect(createdProduct.status).toBe("DRAFT");
      expect(createdProduct.items).toHaveLength(2);
      console.log("✅ Product created successfully:", createdProduct.id);

      // Act: Publish the product [执行：发布产品]
      console.log("Publishing product with batch service type validation...");
      const publishedProduct = await productService.publish(createdProduct.id);

      // Assert [断言]
      expect(publishedProduct).toBeDefined();
      expect(publishedProduct.status).toBe("ACTIVE");
      expect(publishedProduct.publishedAt).toBeDefined();
      console.log("✅ Product published successfully with batch validation");

      // Verify product items in database [验证数据库中的产品项]
      const dbProductItems = await db
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, createdProduct.id))
        .orderBy(schema.productItems.sortOrder);

      expect(dbProductItems).toHaveLength(2);
      expect(dbProductItems[0].serviceTypeId).toBe(testServiceTypeId1);
      expect(dbProductItems[0].quantity).toBe(5);
      expect(dbProductItems[1].serviceTypeId).toBe(testServiceTypeId2);
      expect(dbProductItems[1].quantity).toBe(10);
      console.log("✅ Product items verified in database");
    }, 30000);

    it("should fail to create product when service type is INACTIVE [当服务类型为INACTIVE时应该无法创建产品]", async () => {
      // Arrange [准备]
      // Create an INACTIVE service type for testing [创建一个INACTIVE状态的服务类型用于测试]
      console.log("🔍 Creating INACTIVE service type for testing...");

      const inactiveServiceType = await db
        .insert(schema.serviceTypes)
        .values({
          name: "Inactive Test Service",
          code: `INACTIVE-TEST-SERVICE-${Date.now()}`,
          description: "Test service type with INACTIVE status",
          status: "INACTIVE",
        })
        .returning()
        .then((result) => result[0]);

      console.log("✅ Created INACTIVE service type:", inactiveServiceType.id);

      const userId = randomUUID();
      const createProductDto = {
        name: "Product with Inactive Service",
        code: `INACTIVE-SERVICE-PRODUCT-${Date.now()}`,
        price: 199.99,
        currency: Currency.USD,
        items: [
          {
            serviceTypeId: inactiveServiceType.id,
            quantity: 3,
            sortOrder: 0,
          },
        ],
      };

      // Act & Assert [执行与断言] - Should fail at create() because INACTIVE service types are not allowed [应该在create()时失败，因为不允许使用INACTIVE服务类型]
      console.log("Attempting to create product with inactive service type...");
      await expect(productService.create(createProductDto, userId)).rejects.toThrow(CatalogException);
      console.log("✅ Correctly rejected creation due to inactive service type");

      // Clean up: Delete the created service type [清理：删除创建的服务类型]
      await db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, inactiveServiceType.id));
      console.log("✅ Cleaned up INACTIVE service type");
    }, 30000);
  });

  describe("Product Item Management [产品项管理]", () => {
    it("should successfully add item to existing product [应该成功向现有产品添加项]", async () => {
      // Arrange [准备]
      const userId = randomUUID();

      // Create a product first
      // [首先创建产品]
      const createProductDto = {
        name: "Product for Add Item Test",
        code: `ADD-ITEM-PRODUCT-${Date.now()}`,
        price: 99.99,
        currency: Currency.USD,
        items: [],
      };

      const createdProductId = (await productService.create(createProductDto, userId)).id;
      console.log("Product created for add item test:", createdProductId);

      const addItemDto = {
        serviceTypeId: testServiceTypeId1,
        quantity: 7,
        sortOrder: 0,
      };

      // Act [执行]
      console.log("Adding item to product with batch service type validation...");
      await productService.addItem(createdProductId, addItemDto);
      console.log("✅ Item added to product");

      // Assert: Verify in database [断言：在数据库中验证]
      const dbProductItems = await db
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, createdProductId));

      expect(dbProductItems).toHaveLength(1);
      expect(dbProductItems[0].serviceTypeId).toBe(testServiceTypeId1);
      expect(dbProductItems[0].quantity).toBe(7);
      console.log("✅ Added item verified in database");
    }, 30000);

    it("should fail to add item when service type does not exist [当服务类型不存在时应该无法添加项]", async () => {
      // Arrange [准备]
      const userId = randomUUID();
      const nonExistentServiceTypeId = randomUUID();

      const createProductDto = {
        name: "Product for Non-existent Service Test",
        code: `NONEXISTENT-SERVICE-${Date.now()}`,
        price: 149.99,
        currency: Currency.USD,
        items: [],
      };

      const createdProduct = await productService.create(createProductDto, userId) as IProductDetail;
      console.log("Product created:", createdProduct.id);

      const addItemDto = {
        serviceTypeId: nonExistentServiceTypeId, // Non-existent service type [不存在的服务类型]
        quantity: 5,
        sortOrder: 0,
      };

      // Act & Assert [执行与断言]
      console.log("Attempting to add item with non-existent service type...");
      await expect(productService.addItem(createdProduct.id, addItemDto)).rejects.toThrow(
        CatalogException,
      );
      console.log("✅ Correctly rejected add item due to non-existent service type");
    }, 30000);

    it("should fail to add duplicate item [应该无法添加重复的项]", async () => {
      // Arrange [准备]
      const userId = randomUUID();

      const createProductDto = {
        name: "Product for Duplicate Item Test",
        code: `DUPLICATE-ITEM-PRODUCT-${Date.now()}`,
        price: 199.99,
        currency: Currency.USD,
        items: [
          {
            serviceTypeId: testServiceTypeId1,
            quantity: 5,
            sortOrder: 0,
          },
        ],
      };

      const createdProductId = (await productService.create(createProductDto, userId)).id;
      console.log("Product created with item:", createdProductId);

      const duplicateItem = {
        serviceTypeId: testServiceTypeId1, // Same service type [相同的服务类型]
        quantity: 10,
        sortOrder: 1,
      };

      // Act & Assert [执行与断言]
      console.log("Attempting to add duplicate item...");
      await expect(productService.addItem(createdProductId, duplicateItem)).rejects.toThrow(
        CatalogException,
      );
      console.log("✅ Correctly rejected duplicate item");
    }, 30000);
  });

  describe("Product Lifecycle [产品生命周期]", () => {
    it("should complete full product lifecycle: create → add items → publish → unpublish [应该完成完整的产品生命周期：创建→添加项→发布→取消发布]", async () => {
      // Arrange [准备]
      const userId = randomUUID();

      // Step 1: Create product [步骤1：创建产品]
      console.log("Step 1: Creating product...");
      const createProductDto = {
        name: "Full Lifecycle Product",
        code: `LIFECYCLE-PRODUCT-${Date.now()}`,
        price: 399.99,
        currency: Currency.USD,
        items: [
          {
            serviceTypeId: testServiceTypeId1,
            quantity: 3,
            sortOrder: 0,
          },
        ],
      };

      const createdProductId = (await productService.create(createProductDto, userId)).id;
      let product = await productService.findOne({ id: createdProductId }) as IProductDetail;
      expect(product.status).toBe("DRAFT");
      console.log("✅ Product created in DRAFT status");

      // Step 2: Add another item [步骤2：添加另一个项]
      console.log("Step 2: Adding another item...");
      await productService.addItem(product.id, {
        serviceTypeId: testServiceTypeId2,
        quantity: 5,
        sortOrder: 1,
      });

      const items = await db
        .select()
        .from(schema.productItems)
        .where(eq(schema.productItems.productId, createdProductId));
      expect(items).toHaveLength(2);
      console.log("✅ Second item added, total items:", items.length);

      // Step 3: Publish product [步骤3：发布产品]
      console.log("Step 3: Publishing product...");
      product = await productService.publish(product.id);
      expect(product.status).toBe("ACTIVE");
      expect(product.publishedAt).toBeDefined();
      console.log("✅ Product published");

      // Step 4: Unpublish product [步骤4：取消发布产品]
      console.log("Step 4: Unpublishing product...");
      product = await productService.unpublish(product.id);
      expect(product.status).toBe("INACTIVE"); // unpublish() sets status to INACTIVE [unpublish()将状态设置为INACTIVE]
      expect(product.unpublishedAt).toBeDefined();
      console.log("✅ Product unpublished");

      // Step 5: Revert to draft (should succeed even though already draft) [步骤5：恢复为草稿（即使已经是草稿也应该成功）]
      console.log("Step 5: Reverting to draft...");
      product = await productService.revertToDraft(product.id);
      expect(product.status).toBe("DRAFT");
      console.log("✅ Full product lifecycle completed successfully");
    }, 60000);
  });
});
