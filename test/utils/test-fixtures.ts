import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import {
  ServiceType,
  BillingMode,
  Currency,
  UserType,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";
import * as bcrypt from "bcrypt";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Test fixture factory for creating test data in database
 */
export class TestFixtures {
  constructor(private db: NodePgDatabase<typeof schema>) { }

  /**
   * Create a test user in database
   */
  async createUser(
    overrides: Partial<typeof schema.userTable.$inferInsert> = {},
  ): Promise<typeof schema.userTable.$inferSelect> {
    const timestamp = Date.now();
    const defaultUser = {
      id: randomUUID(),
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
      ...overrides,
      createdBy, // Keep createdBy after overrides to prevent being overridden
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
        },
        {
          type: ProductItemType.SERVICE_PACKAGE,
          referenceId: servicePackage.id,
          quantity: 1,
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
    // Clean up tables in reverse dependency order
    // Use try-catch to handle tables that might not exist yet
    const tables = [
      schema.productItems,
      schema.products,
      schema.servicePackageItems,
      schema.servicePackages,
      schema.services,
    ];

    for (const table of tables) {
      try {
        await this.db.delete(table);
      } catch (error: any) {
        // Ignore "relation does not exist" errors
        const errorMsg = error.message || error.toString() || "";
        const causeMsg = error.cause?.message || "";
        const fullError = errorMsg + " " + causeMsg;

        if (!fullError.includes("does not exist")) {
          throw error;
        }
        // Silently ignore table-does-not-exist errors
      }
    }
  }

  /**
   * Create a test contract in database with real product snapshot
   */
  async createContract(
    createdBy: string,
    studentId: string,
    productId: string,
    overrides: Partial<typeof schema.contracts.$inferInsert> = {},
  ): Promise<typeof schema.contracts.$inferSelect> {
    // Fetch the real product to create snapshot
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId));

    if (!product) {
      throw new Error(`Product ${productId} not found for contract creation`);
    }

    // Fetch product items
    const productItems = await this.db
      .select()
      .from(schema.productItems)
      .where(eq(schema.productItems.productId, productId));

    // Build product snapshot with real data
    const productSnapshot: any = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      price: product.price,
      currency: product.currency,
      validityDays: product.validityDays,
      items: [],
      snapshotAt: new Date(),
    };

    // Expand product items into snapshot
    for (const item of productItems) {
      if (item.type === ProductItemType.SERVICE) {
        const [service] = await this.db
          .select()
          .from(schema.services)
          .where(eq(schema.services.id, item.referenceId));

        if (service) {
          productSnapshot.items.push({
            productItemType: "service",
            productItemId: item.id,
            referenceId: service.id,
            quantity: item.quantity,
            sortOrder: item.sortOrder,
            service: {
              serviceId: service.id,
              serviceName: service.name,
              serviceCode: service.code,
              serviceType: service.serviceType,
              billingMode: service.billingMode,
              requiresEvaluation: service.requiresEvaluation,
              requiresMentorAssignment: service.requiresMentorAssignment,
              metadata: service.metadata || {},
              snapshotAt: new Date(),
            },
          });
        }
      } else if (item.type === ProductItemType.SERVICE_PACKAGE) {
        const [pkg] = await this.db
          .select()
          .from(schema.servicePackages)
          .where(eq(schema.servicePackages.id, item.referenceId));

        if (pkg) {
          const pkgItems = await this.db
            .select()
            .from(schema.servicePackageItems)
            .where(eq(schema.servicePackageItems.packageId, pkg.id));

          const pkgSnapshot: any = {
            servicePackageId: pkg.id,
            servicePackageName: pkg.name,
            servicePackageCode: pkg.code,
            items: [],
            snapshotAt: new Date(),
          };

          for (const pkgItem of pkgItems) {
            const [service] = await this.db
              .select()
              .from(schema.services)
              .where(eq(schema.services.id, pkgItem.serviceId));

            if (service) {
              pkgSnapshot.items.push({
                servicePackageItemId: pkgItem.id,
                serviceId: service.id,
                quantity: pkgItem.quantity,
                sortOrder: pkgItem.sortOrder,
                service: {
                  serviceId: service.id,
                  serviceName: service.name,
                  serviceCode: service.code,
                  serviceType: service.serviceType,
                  billingMode: service.billingMode,
                  requiresEvaluation: service.requiresEvaluation,
                  requiresMentorAssignment: service.requiresMentorAssignment,
                  metadata: service.metadata || {},
                  snapshotAt: new Date(),
                },
              });
            }
          }

          productSnapshot.items.push({
            productItemType: "service_package",
            productItemId: item.id,
            referenceId: pkg.id,
            quantity: item.quantity,
            sortOrder: item.sortOrder,
            servicePackage: pkgSnapshot,
          });
        }
      }
    }

    // Generate contract number
    const contractNumberResult = await this.db.execute(
      sql`SELECT generate_contract_number_v2() as contract_number`,
    );
    const contractNumber = (contractNumberResult.rows[0] as any)
      .contract_number;

    const defaultContract = {
      contractNumber,
      studentId,
      productId,
      productSnapshot,
      status: "signed" as const,
      totalAmount: product.price,
      currency: product.currency,
      validityDays: product.validityDays,
      signedAt: new Date(),
      expiresAt: product.validityDays
        ? new Date(Date.now() + product.validityDays * 24 * 60 * 60 * 1000)
        : null,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    const [contract] = await this.db
      .insert(schema.contracts)
      .values(defaultContract)
      .returning();

    return contract;
  }

  /**
   * Clean up all contract domain test data
   */
  async cleanupAllContractData(): Promise<void> {
    // Clean up tables in reverse dependency order
    // Use try-catch to handle tables that might not exist yet
    const tables = [
      schema.domainEvents,
      schema.serviceHolds,
      schema.serviceLedgers,
      schema.contractServiceEntitlements,
      schema.contracts,
    ];

    for (const table of tables) {
      try {
        await this.db.delete(table);
      } catch (error: any) {
        // Ignore "relation does not exist" errors
        const errorMsg = error.message || error.toString() || "";
        const causeMsg = error.cause?.message || "";
        const fullError = errorMsg + " " + causeMsg;

        if (!fullError.includes("does not exist")) {
          throw error;
        }
        // Silently ignore table-does-not-exist errors
      }
    }
  }

  /**
   * Clean up all test data including users
   * WARNING: This will delete ALL data from catalog and user tables!
   */
  async cleanupAll(): Promise<void> {
    await this.cleanupAllContractData();
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
