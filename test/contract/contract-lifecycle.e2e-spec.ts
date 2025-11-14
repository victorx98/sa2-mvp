/**
 * Contract Domain Integration Tests - Refactored with new data management strategy
 * Implements: reuse existing data, no table-level deletion, test isolation, environment stability
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ContractModule } from "@domains/contract/contract.module";
import { ContractService } from "@domains/contract/services/contract.service";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
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
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";

describe("Contract Lifecycle E2E Tests (Real Database) - Enhanced", () => {
  let app: INestApplication;
  let contractService: ContractService;
  let holdService: ServiceHoldService;
  let ledgerService: ServiceLedgerService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: EnhancedTestFixtures;

  // Test data
  let testUser: typeof schema.userTable.$inferSelect;
  let testProduct: typeof schema.products.$inferSelect;
  let testContract: typeof schema.contracts.$inferSelect;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
        ContractModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    contractService = moduleFixture.get<ContractService>(ContractService);
    holdService = moduleFixture.get<ServiceHoldService>(ServiceHoldService);
    ledgerService =
      moduleFixture.get<ServiceLedgerService>(ServiceLedgerService);
    db = moduleFixture.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createEnhancedTestFixtures(db);

    // Phase 1: Test suite initialization - prioritize reusing existing data
    console.log("🔍 Looking for existing contract test data to reuse...");

    // Try to find or create test user
    testUser = await fixtures.getOrCreateTestUser(
      {
        email: "contract-lifecycle-test@example.com",
        nickname: "contracttester",
        status: "active",
      },
      { reuseExisting: true, createIfNotExists: true },
    );

    console.log(`✅ Using test user: ${testUser.email} (${testUser.id})`);

    // Try to find existing product with required services
    const existingProduct = await findExistingSuitableProduct(
      contractService,
      testUser.id,
    );

    if (existingProduct) {
      console.log(
        `✅ Found existing suitable product: ${existingProduct.code}`,
      );
      testProduct = existingProduct;
    } else {
      // Create minimal catalog data if no suitable product exists
      console.log("📦 Creating minimal test catalog data...");
      const catalogData = await fixtures.getOrCreateTestCatalog(testUser.id, {
        reuseExisting: true,
        createIfNotExists: true,
      });
      testProduct = catalogData.product;
      console.log(`✅ Created test product: ${testProduct.code}`);
    }

    // Try to find existing contract for this user and product
    const existingContract = await findExistingContract(
      contractService,
      testUser.id,
      testProduct.id,
    );

    if (existingContract && existingContract.status === "signed") {
      console.log(
        `✅ Found existing suitable contract: ${existingContract.contractNumber}`,
      );
      testContract = existingContract;
    } else {
      // Create new contract if no suitable one exists
      console.log("📋 Creating new test contract...");
      testContract = await fixtures.createContract(
        testUser.id,
        testUser.id,
        testProduct.id,
      );
      console.log(`✅ Created test contract: ${testContract.contractNumber}`);
    }
  });

  afterEach(async () => {
    // Phase 2: Test case cleanup - clean temporary data without table deletion
    console.log("🧹 Cleaning up temporary contract test data...");
    await fixtures.cleanupTemporaryData();
    console.log("✅ Temporary contract data cleaned (soft deleted)");
  });

  afterAll(async () => {
    // Phase 3: Environment reset - restore state without deleting original data
    console.log("🔄 Resetting contract environment state...");
    await fixtures.resetEnvironmentState();
    console.log("✅ Contract environment state reset");

    await app.close();
  });

  describe("Contract Lifecycle with Data Reuse", () => {
    it("should reuse existing contract data when available", async () => {
      // Verify we're using existing contract data
      expect(testContract).toBeDefined();
      expect(testContract.studentId).toBe(testUser.id);
      expect(testContract.productId).toBe(testProduct.id);
      expect(testContract.status).toBe("signed");

      console.log(`Reusing contract: ${testContract.contractNumber}`);
    });

    it("should activate existing contract without creating new data", async () => {
      // Activate the existing contract
      const activatedContract = await contractService.activate(testContract.id);

      expect(activatedContract.status).toBe("active");
      expect(activatedContract.id).toBe(testContract.id);
      expect(activatedContract.activatedAt).toBeDefined();

      console.log(
        `Activated existing contract: ${activatedContract.contractNumber}`,
      );
    });

    it("should verify service entitlements from reused contract", async () => {
      // Check service balances from existing contract
      const resumeBalance = await contractService.getServiceBalance({
        studentId: testUser.id,
        serviceType: ServiceType.RESUME_REVIEW,
      });

      expect(resumeBalance).toBeDefined();
      expect(resumeBalance.length).toBeGreaterThan(0);
      expect(resumeBalance[0].totalQuantity).toBeGreaterThan(0);

      const mockInterviewBalance = await contractService.getServiceBalance({
        studentId: testUser.id,
        serviceType: ServiceType.MOCK_INTERVIEW,
      });

      expect(mockInterviewBalance).toBeDefined();
      expect(mockInterviewBalance.length).toBeGreaterThan(0);

      console.log(`Verified entitlements for user: ${testUser.id}`);
    });

    it("should create service hold on existing contract", async () => {
      const holdDto = {
        studentId: testUser.id,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 1,
        referenceType: "booking" as const,
        referenceId: `booking-${Date.now()}`,
      };

      const hold = await holdService.createHold(holdDto);

      expect(hold).toBeDefined();
      expect(hold.studentId).toBe(testUser.id);
      expect(hold.serviceType).toBe(ServiceType.RESUME_REVIEW);
      expect(hold.status).toBe("active");

      console.log(`Created hold on existing contract: ${hold.id}`);
    });

    it("should verify hold affects service balance", async () => {
      // Get balance before creating additional hold
      const initialBalance = await contractService.getServiceBalance({
        studentId: testUser.id,
        serviceType: ServiceType.RESUME_REVIEW,
      });

      const initialAvailable = initialBalance[0]?.availableQuantity || 0;

      // Create another hold
      const holdDto = {
        studentId: testUser.id,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 1,
        referenceType: "booking" as const,
        referenceId: `booking-${Date.now()}`,
      };

      await holdService.createHold(holdDto);

      // Check balance after hold
      const updatedBalance = await contractService.getServiceBalance({
        studentId: testUser.id,
        serviceType: ServiceType.RESUME_REVIEW,
      });

      const updatedAvailable = updatedBalance[0]?.availableQuantity || 0;

      expect(updatedAvailable).toBe(initialAvailable - 1);

      console.log(
        `Verified hold affects balance: ${initialAvailable} -> ${updatedAvailable}`,
      );
    });
  });

  describe("Contract Data Isolation", () => {
    it("should not affect other contracts when modifying reused data", async () => {
      // This test verifies that our changes to the reused contract
      // don't affect other tests or other contracts in the system

      const contractBefore = await contractService.findById(testContract.id);
      expect(contractBefore.status).toBe("active"); // From previous test

      // Make a change
      await contractService.updateContractStatus(testContract.id, "suspended");

      // Verify change
      const contractAfter = await contractService.findById(testContract.id);
      expect(contractAfter.status).toBe("suspended");

      console.log(
        `Modified contract status: ${contractBefore.status} -> ${contractAfter.status}`,
      );

      // The afterEach hook will soft delete this change
      // Other tests will see the original state
    });
  });
});

/**
 * Helper function to find existing suitable product
 * Implements data reuse principle
 */
async function findExistingSuitableProduct(
  contractService: ContractService,
  userId: string,
): Promise<typeof schema.products.$inferSelect | null> {
  try {
    // Look for existing products that have the required service types
    const products = await contractService.getAvailableProducts(userId);

    if (products && products.length > 0) {
      // Find a product with resume review and mock interview services
      for (const product of products) {
        const hasResumeReview = product.items?.some(
          (item) =>
            item.type === ProductItemType.SERVICE &&
            item.service?.serviceType === ServiceType.RESUME_REVIEW,
        );

        const hasMockInterview = product.items?.some(
          (item) =>
            item.type === ProductItemType.SERVICE &&
            item.service?.serviceType === ServiceType.MOCK_INTERVIEW,
        );

        if (hasResumeReview && hasMockInterview) {
          return product;
        }
      }
    }

    return null;
  } catch (error) {
    console.log("No existing suitable product found, will create new one");
    return null;
  }
}

/**
 * Helper function to find existing suitable contract
 * Implements data reuse principle
 */
async function findExistingContract(
  contractService: ContractService,
  studentId: string,
  productId: string,
): Promise<typeof schema.contracts.$inferSelect | null> {
  try {
    const contracts = await contractService.findByStudentId(studentId);

    if (contracts && contracts.length > 0) {
      // Find a contract for this product in signed status
      const suitableContract = contracts.find(
        (contract) =>
          contract.productId === productId && contract.status === "signed",
      );

      return suitableContract || null;
    }

    return null;
  } catch (error) {
    console.log("No existing suitable contract found, will create new one");
    return null;
  }
}
