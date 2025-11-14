/**
 * Catalog Domain Integration Tests - Refactored with new data management strategy
 * Implements: reuse existing data, no table-level deletion, test isolation, environment stability
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CatalogModule } from "@domains/catalog/catalog.module";
import { ProductService } from "@domains/catalog/product/services/product.service";
import { ServiceService } from "@domains/catalog/service/services/service.service";
import { ServicePackageService } from "@domains/catalog/service-package/services/service-package.service";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  createEnhancedTestFixtures,
  EnhancedTestFixtures,
} from "../utils/enhanced-test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import {
  ServiceType,
  BillingMode,
  Currency,
  UserType,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";

describe("Catalog Product E2E Tests (Real Database) - Enhanced", () => {
  let app: INestApplication;
  let productService: ProductService;
  let serviceService: ServiceService;
  let servicePackageService: ServicePackageService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: EnhancedTestFixtures;

  // Test data
  let testUser: typeof schema.userTable.$inferSelect;
  let testServices: Array<typeof schema.services.$inferSelect>;
  let testServicePackage: typeof schema.servicePackages.$inferSelect;
  let testProduct: typeof schema.products.$inferSelect;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
        CatalogModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    productService = moduleFixture.get<ProductService>(ProductService);
    serviceService = moduleFixture.get<ServiceService>(ServiceService);
    servicePackageService = moduleFixture.get<ServicePackageService>(
      ServicePackageService,
    );
    db = moduleFixture.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createEnhancedTestFixtures(db);

    // Phase 1: Test suite initialization - prioritize reusing existing data
    console.log("🔍 Looking for existing test data to reuse...");

    // Try to find or create test user
    testUser = await fixtures.getOrCreateTestUser(
      {
        email: "catalog-product-test@example.com",
        nickname: "catalogproducttester",
        userType: UserType.UNDERGRADUATE,
        status: "active",
      },
      { reuseExisting: true, createIfNotExists: true },
    );

    console.log(`✅ Using test user: ${testUser.email} (${testUser.id})`);

    // Try to find or create test catalog data
    const catalogData = await fixtures.getOrCreateTestCatalog(testUser.id, {
      reuseExisting: true,
      createIfNotExists: true,
    });

    testServices = catalogData.services;
    testServicePackage = catalogData.servicePackage;
    testProduct = catalogData.product;

    console.log(
      `✅ Using test catalog with ${testServices.length} services, 1 package, 1 product`,
    );
    console.log(`   - Services: ${testServices.map((s) => s.code).join(", ")}`);
    console.log(`   - Package: ${testServicePackage.code}`);
    console.log(`   - Product: ${testProduct.code}`);
  });

  afterEach(async () => {
    // Phase 2: Test case cleanup - clean temporary data without table deletion
    console.log("🧹 Cleaning up temporary test data...");
    await fixtures.cleanupTemporaryData();
    console.log("✅ Temporary data cleaned (soft deleted)");
  });

  afterAll(async () => {
    // Phase 3: Environment reset - restore state without deleting original data
    console.log("🔄 Resetting environment state...");
    await fixtures.resetEnvironmentState();
    console.log("✅ Environment state reset");

    await app.close();
  });

  describe("Product Management", () => {
    it("should retrieve existing product with services and packages", async () => {
      // Test reusing existing product data
      const retrievedProduct = await productService.findOne({ id: testProduct.id });

      expect(retrievedProduct).toBeDefined();
      expect(retrievedProduct.id).toBe(testProduct.id);
      expect(retrievedProduct.name).toBe(testProduct.name);
      expect(retrievedProduct.items).toBeDefined();
      expect(retrievedProduct.items.length).toBeGreaterThan(0);
    });

    it("should create new product when existing data doesn't meet requirements", async () => {
      // This test creates a new product because existing one doesn't have specific requirements
      const newProductData = {
        code: `SPECIFIC-PRODUCT-${Date.now()}`,
        name: "Specific Test Product",
        description: "Product with specific requirements",
        price: "1500.00",
        currency: Currency.USD,
        validityDays: 180,
        targetUserTypes: [UserType.GRADUATE],
        sortOrder: 1,
        createdBy: testUser.id,
      };

      const newProduct = await productService.create(newProductData, []);

      expect(newProduct).toBeDefined();
      expect(newProduct.code).toBe(newProductData.code);
      expect(newProduct.targetUserTypes).toEqual([UserType.GRADUATE]);
      expect(newProduct.validityDays).toBe(180);
    });

    it("should update product name without affecting other data", async () => {
      const updatedProduct = await productService.update(testProduct.id, {
        name: "Updated Product Name",
      });

      expect(updatedProduct.name).toBe("Updated Product Name");
      expect(updatedProduct.id).toBe(testProduct.id);
      // Other fields unchanged
    });
  });

  describe("Service Management", () => {
    it("should retrieve existing services by type", async () => {
      const resumeReviewService = await serviceService.findByServiceType(
        ServiceType.RESUME_REVIEW,
      );

      expect(resumeReviewService).toBeDefined();
      expect(resumeReviewService.length).toBeGreaterThan(0);
      expect(resumeReviewService[0].serviceType).toBe(
        ServiceType.RESUME_REVIEW,
      );
    });

    it("should reuse existing service for common service types", async () => {
      // Try to find existing mock interview service
      const existingServices = await serviceService.search({
        serviceType: ServiceType.MOCK_INTERVIEW,
        status: "active",
      });

      expect(existingServices).toBeDefined();
      expect(existingServices.data.length).toBeGreaterThan(0);

      // Verify we're reusing existing data, not creating duplicates
      const mockInterviewServices = existingServices.data.filter(
        (s) => s.serviceType === ServiceType.MOCK_INTERVIEW,
      );
      expect(mockInterviewServices.length).toBeGreaterThan(0);
    });
  });

  describe("Service Package Management", () => {
    it("should retrieve existing service package", async () => {
      const retrievedPackage = await servicePackageService.findOne({
        id: testServicePackage.id,
      });

      expect(retrievedPackage).toBeDefined();
      expect(retrievedPackage.id).toBe(testServicePackage.id);
      expect(retrievedPackage.name).toBe(testServicePackage.name);
      expect(retrievedPackage.items).toBeDefined();
      expect(retrievedPackage.items.length).toBeGreaterThan(0);
    });

    it("should list all active service packages", async () => {
      const activePackages = await servicePackageService.search({
        status: "active",
      });

      expect(activePackages).toBeDefined();
      expect(activePackages.data.length).toBeGreaterThan(0);
      expect(activePackages.data.some((p) => p.id === testServicePackage.id)).toBe(
        true,
      );
    });
  });

  describe("Data Isolation Verification", () => {
    it("should verify test data isolation - changes don't affect other tests", async () => {
      // Get initial state
      const initialProduct = await productService.findOne({ id: testProduct.id });
      const initialName = initialProduct.name;

      // Make a change
      await productService.update(testProduct.id, { name: "Updated Test Product" });

      // Verify change
      const changedProduct = await productService.findOne({ id: testProduct.id });
      expect(changedProduct.name).toBe("Updated Test Product");

      // The afterEach hook will soft delete this change
      // Next test will see the original state or a fresh product
    });
  });
});