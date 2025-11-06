import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import {
  ServiceType,
  BillingMode,
  ServiceUnit,
  Currency,
  UserType,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";
import * as bcrypt from "bcrypt";

/**
 * Test fixture factory for creating test data in database
 */
export class TestFixtures {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  /**
   * Create a test user in database
   */
  async createUser(
    overrides: Partial<typeof schema.userTable.$inferInsert> = {},
  ): Promise<typeof schema.userTable.$inferSelect> {
    const timestamp = Date.now();
    const defaultUser = {
      id: `user-${timestamp}`,
      email: `test-${timestamp}@example.com`,
      password: await bcrypt.hash("Test123456", 10),
      username: `testuser-${timestamp}`,
      ...overrides,
    };

    const [user] = await this.db
      .insert(schema.userTable)
      .values(defaultUser)
      .returning();
    return user;
  }

  /**
   * Create a test service in database
   */
  async createService(
    createdBy: string,
    overrides: Partial<typeof schema.services.$inferInsert> = {},
  ): Promise<typeof schema.services.$inferSelect> {
    const timestamp = Date.now();
    const defaultService = {
      code: `TEST-SERVICE-${timestamp}`,
      serviceType: ServiceType.GAP_ANALYSIS,
      name: `Test Service ${timestamp}`,
      description: "Test service description",
      billingMode: BillingMode.ONE_TIME,
      defaultUnit: ServiceUnit.TIMES,
      requiresEvaluation: false,
      requiresMentorAssignment: true,
      status: "active" as const,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const [service] = await this.db
      .insert(schema.services)
      .values(defaultService)
      .returning();
    return service;
  }

  /**
   * Create multiple test services in database
   * Note: Each service_type can only be used once due to unique constraint
   */
  async createServices(
    createdBy: string,
    count: number,
    baseOverrides: Partial<typeof schema.services.$inferInsert> = {},
  ): Promise<Array<typeof schema.services.$inferSelect>> {
    const serviceTypes = Object.values(ServiceType);

    if (count > serviceTypes.length) {
      throw new Error(
        `Cannot create ${count} services - only ${serviceTypes.length} service types available due to unique constraint`,
      );
    }

    const services: Array<typeof schema.services.$inferSelect> = [];

    for (let i = 0; i < count; i++) {
      // Use timestamp and index to ensure unique codes
      const timestamp = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 2)); // Small delay to ensure unique timestamps

      const service = await this.createService(createdBy, {
        ...baseOverrides,
        code: `TEST-SERVICE-${timestamp}-${i}`,
        serviceType: serviceTypes[i], // Use sequential service types, no cycling
      });
      services.push(service);
    }

    return services;
  }

  /**
   * Create a test service package in database
   */
  async createServicePackage(
    createdBy: string,
    serviceIds: string[],
    overrides: Partial<typeof schema.servicePackages.$inferInsert> = {},
  ): Promise<typeof schema.servicePackages.$inferSelect> {
    const timestamp = Date.now();
    const defaultPackage = {
      code: `TEST-PACKAGE-${timestamp}`,
      name: `Test Package ${timestamp}`,
      description: "Test package description",
      status: "active" as const,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const [servicePackage] = await this.db
      .insert(schema.servicePackages)
      .values(defaultPackage)
      .returning();

    // Create package items
    const items = serviceIds.map((serviceId, index) => ({
      packageId: servicePackage.id,
      serviceId,
      quantity: 1,
      unit: ServiceUnit.TIMES,
      sortOrder: index,
      createdAt: new Date(),
    }));

    await this.db.insert(schema.servicePackageItems).values(items);

    return servicePackage;
  }

  /**
   * Create a test product in database
   */
  async createProduct(
    createdBy: string,
    items: Array<{
      type: ProductItemType;
      referenceId: string;
      quantity: number;
      unit: ServiceUnit;
    }>,
    overrides: Partial<typeof schema.products.$inferInsert> = {},
  ): Promise<typeof schema.products.$inferSelect> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const defaultProduct = {
      code: `TEST-PRODUCT-${timestamp}-${random}`,
      name: `Test Product ${timestamp}`,
      description: "Test product description",
      price: "999.00",
      currency: Currency.USD,
      validityDays: 365,
      targetUserTypes: [UserType.UNDERGRADUATE],
      status: "draft" as const,
      sortOrder: 0,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const [product] = await this.db
      .insert(schema.products)
      .values(defaultProduct)
      .returning();

    // Create product items
    const productItems = items.map((item, index) => ({
      productId: product.id,
      type: item.type,
      referenceId: item.referenceId,
      quantity: item.quantity,
      unit: item.unit,
      sortOrder: index,
      createdAt: new Date(),
    }));

    await this.db.insert(schema.productItems).values(productItems);

    return product;
  }

  /**
   * Create a complete test catalog setup (services, packages, products)
   */
  async createCompleteCatalog(createdBy: string): Promise<{
    services: Array<typeof schema.services.$inferSelect>;
    servicePackage: typeof schema.servicePackages.$inferSelect;
    product: typeof schema.products.$inferSelect;
  }> {
    // Create 3 services
    const services = await this.createServices(createdBy, 3, {
      status: "active",
    });

    // Create a service package with 2 services
    const servicePackage = await this.createServicePackage(
      createdBy,
      [services[0].id, services[1].id],
      { status: "active" },
    );

    // Create a product with 1 service and 1 package
    const product = await this.createProduct(
      createdBy,
      [
        {
          type: ProductItemType.SERVICE,
          referenceId: services[2].id,
          quantity: 1,
          unit: ServiceUnit.TIMES,
        },
        {
          type: ProductItemType.SERVICE_PACKAGE,
          referenceId: servicePackage.id,
          quantity: 1,
          unit: ServiceUnit.TIMES,
        },
      ],
      { status: "draft" },
    );

    return { services, servicePackage, product };
  }

  /**
   * Clean up all test data from catalog tables
   * WARNING: This will delete ALL data from catalog tables!
   */
  async cleanupAllCatalogData(): Promise<void> {
    await this.db.delete(schema.productItems);
    await this.db.delete(schema.products);
    await this.db.delete(schema.servicePackageItems);
    await this.db.delete(schema.servicePackages);
    await this.db.delete(schema.services);
  }

  /**
   * Clean up all test data including users
   * WARNING: This will delete ALL data from catalog and user tables!
   */
  async cleanupAll(): Promise<void> {
    await this.cleanupAllCatalogData();
    await this.db.delete(schema.userTable);
  }
}

/**
 * Create test fixtures instance
 */
export function createTestFixtures(
  db: NodePgDatabase<typeof schema>,
): TestFixtures {
  return new TestFixtures(db);
}
