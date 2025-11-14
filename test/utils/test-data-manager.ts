/**
 * Test Data Manager - New data management strategy for integration tests
 * Implements the principles: reuse existing data, no table-level deletion, test isolation, environment stability
 */

import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, inArray, sql } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";
import {
  ServiceType,
  BillingMode,
  Currency,
  UserType,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";
import { v7 as uuidv7 } from "uuid";

export interface IDataReuseOptions {
  reuseExisting?: boolean; // Whether to reuse existing data
  createIfNotExists?: boolean; // Whether to create if not exists
  cleanupAfterTest?: boolean; // Whether to cleanup after individual test
}

export interface ITestDataTracker {
  createdUserIds: string[];
  createdServiceIds: string[];
  createdPackageIds: string[];
  createdProductIds: string[];
  createdContractIds: string[];
  createdHoldIds: string[];
  createdLedgerIds: string[];
  createdEntitlementIds: string[];
}

export class TestDataManager {
  private dataTracker: ITestDataTracker;

  constructor(private db: NodePgDatabase<typeof schema>) {
    this.dataTracker = this.initializeTracker();
  }

  private initializeTracker(): ITestDataTracker {
    return {
      createdUserIds: [],
      createdServiceIds: [],
      createdPackageIds: [],
      createdProductIds: [],
      createdContractIds: [],
      createdHoldIds: [],
      createdLedgerIds: [],
      createdEntitlementIds: [],
    };
  }

  /**
   * Find existing test user that matches criteria
   * Reuse existing data principle implementation
   */
  async findExistingTestUser(criteria: {
    email?: string;
    userType?: UserType;
    status?: string;
  }): Promise<typeof schema.userTable.$inferSelect | null> {
    const conditions = [];

    if (criteria.email) {
      conditions.push(eq(schema.userTable.email, criteria.email));
    }
    if (criteria.status) {
      conditions.push(eq(schema.userTable.status, criteria.status));
    }
    if (conditions.length === 0) {
      return null;
    }

    // Look for test users first (emails containing 'test' or 'example')
    const [user] = await this.db
      .select()
      .from(schema.userTable)
      .where(
        and(
          ...conditions,
          sql`${schema.userTable.email} LIKE '%test%' OR ${schema.userTable.email} LIKE '%example%'`,
        ),
      )
      .limit(1);

    return user || null;
  }

  /**
   * Find existing service that matches criteria
   */
  async findExistingService(criteria: {
    serviceType?: ServiceType;
    status?: string;
    billingMode?: BillingMode;
  }): Promise<typeof schema.services.$inferSelect | null> {
    const conditions = [];

    if (criteria.serviceType) {
      conditions.push(eq(schema.services.serviceType, criteria.serviceType));
    }
    if (criteria.status) {
      conditions.push(eq(schema.services.status, criteria.status as any));
    }
    if (criteria.billingMode) {
      conditions.push(eq(schema.services.billingMode, criteria.billingMode));
    }

    const [service] = await this.db
      .select()
      .from(schema.services)
      .where(and(...conditions))
      .limit(1);

    return service || null;
  }

  /**
   * Find existing product with required services
   */
  async findExistingProductWithServices(
    _requiredServiceTypes: ServiceType[],
  ): Promise<typeof schema.products.$inferSelect | null> {
    // This is a complex query - for now, return null to trigger creation
    // In a real implementation, this would query products and their items
    return null;
  }

  /**
   * Get or create test user - implements reuse principle
   */
  async getOrCreateTestUser(
    userData: Partial<typeof schema.userTable.$inferInsert>,
    options: IDataReuseOptions = {
      reuseExisting: true,
      createIfNotExists: true,
    },
  ): Promise<typeof schema.userTable.$inferSelect> {
    // Try to find existing user first
    if (options.reuseExisting) {
      const existingUser = await this.findExistingTestUser({
        email: userData.email,
        status: userData.status,
      });

      if (existingUser) {
        return existingUser;
      }
    }

    // Create new user if allowed
    if (options.createIfNotExists) {
      const timestamp = Date.now();
      const newUser = {
        id: uuidv7(), // Generate proper UUID for database
        email: `test-${timestamp}@example.com`,
        password: userData.password || (await this.hashPassword("Test123456")),
        username: `testuser-${timestamp}`,
        nickname: `Test User ${timestamp}`,
        userType: UserType.UNDERGRADUATE,
        status: "active",
        ...userData,
      };

      const [user] = await this.db
        .insert(schema.userTable)
        .values(newUser)
        .returning();

      this.dataTracker.createdUserIds.push(user.id);
      return user;
    }

    throw new Error("No existing user found and creation not allowed");
  }

  /**
   * Get or create test service - implements reuse principle
   */
  async getOrCreateTestService(
    createdBy: string,
    serviceData: Partial<typeof schema.services.$inferInsert>,
    options: IDataReuseOptions = {
      reuseExisting: true,
      createIfNotExists: true,
    },
  ): Promise<typeof schema.services.$inferSelect> {
    // Try to find existing service first
    if (options.reuseExisting) {
      const existingService = await this.findExistingService({
        serviceType: serviceData.serviceType as ServiceType,
        status: serviceData.status,
        billingMode: serviceData.billingMode as BillingMode,
      });

      if (existingService) {
        return existingService;
      }
    }

    // Create new service if allowed
    if (options.createIfNotExists) {
      const timestamp = Date.now();
      const newService = {
        code: `test-service-${timestamp}`,
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
        ...serviceData,
      };

      const [service] = await this.db
        .insert(schema.services)
        .values(newService)
        .returning();

      this.dataTracker.createdServiceIds.push(service.id);
      return service;
    }

    throw new Error("No existing service found and creation not allowed");
  }

  /**
   * Get or create complete test catalog setup
   * Reuses existing data when possible
   */
  async getOrCreateTestCatalog(
    userId: string,
    options: IDataReuseOptions = {
      reuseExisting: true,
      createIfNotExists: true,
    },
  ): Promise<{
    services: Array<typeof schema.services.$inferSelect>;
    servicePackage: typeof schema.servicePackages.$inferSelect;
    product: typeof schema.products.$inferSelect;
  }> {
    // For now, create new catalog data
    // In future implementation, this would check for existing suitable data

    // Create services
    const services = [];
    const serviceTypes = [
      ServiceType.RESUME_REVIEW,
      ServiceType.MOCK_INTERVIEW,
      ServiceType.SESSION,
    ];

    for (const serviceType of serviceTypes) {
      const service = await this.getOrCreateTestService(
        userId,
        {
          serviceType,
          status: "active",
        },
        options,
      );
      services.push(service);
    }

    // Create service package
    const servicePackage = await this.createServicePackage(
      userId,
      [services[0].id, services[1].id],
      { status: "active" },
    );

    // Create product
    const product = await this.createProduct(
      userId,
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
      { status: "active" },
    );

    return { services, servicePackage, product };
  }

  /**
   * Create service package (always creates new - packages are specific)
   */
  private async createServicePackage(
    createdBy: string,
    serviceIds: string[],
    overrides: Partial<typeof schema.servicePackages.$inferInsert> = {},
  ): Promise<typeof schema.servicePackages.$inferSelect> {
    const timestamp = Date.now();
    const defaultPackage = {
      code: `test-package-${timestamp}`,
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

    this.dataTracker.createdPackageIds.push(servicePackage.id);
    return servicePackage;
  }

  /**
   * Create product (always creates new - products are specific)
   */
  private async createProduct(
    createdBy: string,
    items: Array<{
      type: ProductItemType;
      referenceId: string;
      quantity: number;
    }>,
    overrides: Partial<typeof schema.products.$inferInsert> = {},
  ): Promise<typeof schema.products.$inferSelect> {
    const timestamp = Date.now();
    const defaultProduct = {
      code: `test-product-${timestamp}`,
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

    this.dataTracker.createdProductIds.push(product.id);
    return product;
  }

  /**
   * Clean up temporary data created during test
   * No table-level deletion - only soft delete or specific record cleanup
   */
  async cleanupTemporaryData(): Promise<void> {
    // Soft delete created contracts (mark as cancelled instead of deleting)
    if (this.dataTracker.createdContractIds.length > 0) {
      await this.db
        .update(schema.contracts)
        .set({
          status: "terminated",
          updatedAt: new Date(),
        })
        .where(
          inArray(schema.contracts.id, this.dataTracker.createdContractIds),
        );
    }

    // Soft delete created products (mark as inactive instead of deleting)
    if (this.dataTracker.createdProductIds.length > 0) {
      await this.db
        .update(schema.products)
        .set({
          status: "inactive",
          updatedAt: new Date(),
        })
        .where(inArray(schema.products.id, this.dataTracker.createdProductIds));
    }

    // Soft delete created services (mark as inactive instead of deleting)
    if (this.dataTracker.createdServiceIds.length > 0) {
      await this.db
        .update(schema.services)
        .set({
          status: "inactive",
          updatedAt: new Date(),
        })
        .where(inArray(schema.services.id, this.dataTracker.createdServiceIds));
    }

    // Soft delete created packages (mark as inactive instead of deleting)
    if (this.dataTracker.createdPackageIds.length > 0) {
      await this.db
        .update(schema.servicePackages)
        .set({
          status: "inactive",
          updatedAt: new Date(),
        })
        .where(
          inArray(
            schema.servicePackages.id,
            this.dataTracker.createdPackageIds,
          ),
        );
    }

    // Reset tracker for next test
    this.dataTracker = this.initializeTracker();
  }

  /**
   * Reset environment state without deleting original data
   */
  async resetEnvironmentState(): Promise<void> {
    // Cancel any pending holds
    if (this.dataTracker.createdHoldIds.length > 0) {
      await this.db
        .update(schema.serviceHolds)
        .set({
          status: "cancelled" as const,
          updatedAt: new Date(),
        })
        .where(
          inArray(schema.serviceHolds.id, this.dataTracker.createdHoldIds),
        );
    }

    // Reset any test-specific state
    // This is where we'd add any environment state reset logic
    // without deleting original data
  }

  /**
   * Get data tracker for external access
   */
  getDataTracker(): ITestDataTracker {
    return { ...this.dataTracker };
  }

  /**
   * Helper method to hash passwords
   */
  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import("bcrypt");
    return bcrypt.hash(password, 10);
  }
}
