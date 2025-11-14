/**
 * Enhanced Test Fixtures with new data management strategy
 * Maintains backward compatibility while implementing new principles
 */

import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { TestDataManager, IDataReuseOptions } from "./test-data-manager";
import * as schema from "@infrastructure/database/schema";
import { eq, sql } from "drizzle-orm";
import {
  ServiceType,
  BillingMode,
  Currency,
  UserType,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";
import * as bcrypt from "bcrypt";

/**
 * Enhanced Test Fixtures that implement new data management principles
 * Backward compatible with existing tests but encourages data reuse
 */
export class EnhancedTestFixtures {
  private dataManager: TestDataManager;

  constructor(private db: NodePgDatabase<typeof schema>) {
    this.dataManager = new TestDataManager(db);
  }

  /**
   * Create a test user with data reuse support
   * @deprecated Use getOrCreateTestUser for better data reuse
   */
  async createUser(
    overrides: Partial<typeof schema.userTable.$inferInsert> = {},
    options: IDataReuseOptions = {
      reuseExisting: false,
      createIfNotExists: true,
    },
  ): Promise<typeof schema.userTable.$inferSelect> {
    if (options.reuseExisting) {
      return this.dataManager.getOrCreateTestUser(overrides, options);
    }

    // Legacy behavior - always create new
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
   * Create a test service with data reuse support
   * @deprecated Use getOrCreateTestService for better data reuse
   */
  async createService(
    createdBy: string,
    overrides: Partial<typeof schema.services.$inferInsert> = {},
    options: IDataReuseOptions = {
      reuseExisting: false,
      createIfNotExists: true,
    },
  ): Promise<typeof schema.services.$inferSelect> {
    if (options.reuseExisting) {
      return this.dataManager.getOrCreateTestService(
        createdBy,
        overrides,
        options,
      );
    }

    // Legacy behavior - always create new
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
   * Get or create test user - new method for data reuse
   */
  async getOrCreateTestUser(
    userData: Partial<typeof schema.userTable.$inferInsert>,
    options?: IDataReuseOptions,
  ): Promise<typeof schema.userTable.$inferSelect> {
    return this.dataManager.getOrCreateTestUser(userData, options);
  }

  /**
   * Get or create test service - new method for data reuse
   */
  async getOrCreateTestService(
    createdBy: string,
    serviceData: Partial<typeof schema.services.$inferInsert>,
    options?: IDataReuseOptions,
  ): Promise<typeof schema.services.$inferSelect> {
    return this.dataManager.getOrCreateTestService(
      createdBy,
      serviceData,
      options,
    );
  }

  /**
   * Get or create complete test catalog - new method for data reuse
   */
  async getOrCreateTestCatalog(
    createdBy: string,
    options?: IDataReuseOptions,
  ): Promise<{
    services: Array<typeof schema.services.$inferSelect>;
    servicePackage: typeof schema.servicePackages.$inferSelect;
    product: typeof schema.products.$inferSelect;
  }> {
    return this.dataManager.getOrCreateTestCatalog(createdBy, options);
  }

  /**
   * Create service package (backward compatible)
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
   * Create test product (backward compatible)
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
      createdBy,
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
   * Create test contract (backward compatible)
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
   * Clean up temporary data created during test
   * No table-level deletion - implements new principle
   */
  async cleanupTemporaryData(): Promise<void> {
    return this.dataManager.cleanupTemporaryData();
  }

  /**
   * Reset environment state without deleting original data
   */
  async resetEnvironmentState(): Promise<void> {
    return this.dataManager.resetEnvironmentState();
  }

  /**
   * Get data tracker for monitoring created data
   */
  getDataTracker() {
    return this.dataManager.getDataTracker();
  }

  /**
   * Legacy cleanup methods - deprecated, will be removed
   * These methods are kept for backward compatibility but should not be used
   */
  async cleanupAllCatalogData(): Promise<void> {
    console.warn(
      "cleanupAllCatalogData is deprecated and will not perform any action",
    );
    // No-op to prevent table deletion
  }

  async cleanupAllContractData(): Promise<void> {
    console.warn(
      "cleanupAllContractData is deprecated and will not perform any action",
    );
    // No-op to prevent table deletion
  }

  async cleanupAll(): Promise<void> {
    console.warn("cleanupAll is deprecated and will not perform any action");
    // No-op to prevent table deletion
  }
}

/**
 * Create enhanced test fixtures instance
 */
export function createEnhancedTestFixtures(
  db: NodePgDatabase<typeof schema>,
): EnhancedTestFixtures {
  return new EnhancedTestFixtures(db);
}
