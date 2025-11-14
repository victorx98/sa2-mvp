/**
 * Financial Domain Integration Tests - Refactored with new data management strategy
 * Implements: reuse existing data, no table-level deletion, test isolation, environment stability
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { v7 as uuidv7 } from "uuid";
import { FinancialModule } from "@domains/financial/financial.module";
import { IMentorPayableService } from "@domains/financial/interfaces/mentor-payable.interface";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  createEnhancedTestFixtures,
  EnhancedTestFixtures,
} from "test/utils/enhanced-test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { IMentorPayableLedger } from "@domains/financial/interfaces/mentor-payable.interface";
import * as schema from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";

describe("Financial Domain E2E Tests (Real Database) - Enhanced", () => {
  let app: INestApplication;
  let mentorPayableService: IMentorPayableService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: EnhancedTestFixtures;

  // Test data
  let testUser: typeof schema.userTable.$inferSelect;
  let testContract: typeof schema.contracts.$inferSelect;
  let testMentorUser: typeof schema.userTable.$inferSelect;
  let testMentorPayableLedger: IMentorPayableLedger;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
          }),
          DatabaseModule,
          FinancialModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      mentorPayableService = moduleFixture.get<IMentorPayableService>("IMentorPayableService");
      db = moduleFixture.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
      fixtures = createEnhancedTestFixtures(db);

      // Phase 1: Test suite initialization - prioritize reusing existing data
      console.log("🔍 Looking for existing financial test data to reuse...");

      // Try to find or create test student user
      testUser = await fixtures.getOrCreateTestUser(
        {
          email: "financial-test-student@example.com",
          nickname: "financialstudent",
          status: "active",
        },
        { reuseExisting: true, createIfNotExists: true },
      );

      // Try to find or create test mentor user
      testMentorUser = await fixtures.getOrCreateTestUser(
        {
          email: "financial-test-mentor@example.com",
          nickname: "financialmentor",
          status: "active",
        },
        { reuseExisting: true, createIfNotExists: true },
      );

      console.log(`✅ Using test student: ${testUser.email} (${testUser.id})`);
      console.log(`✅ Using test mentor: ${testMentorUser.email} (${testMentorUser.id})`);

      // Try to find existing contract for this student
      const existingContract = await findExistingContractForStudent(testUser.id, db);

      if (existingContract && existingContract.status === "signed") {
        console.log(
          `✅ Found existing suitable contract: ${existingContract.contractNumber}`,
        );
        testContract = existingContract;
      } else {
        // Create new contract if no suitable one exists
        console.log("📋 Creating new test contract...");
        const catalogData = await fixtures.getOrCreateTestCatalog(testUser.id, {
          reuseExisting: true,
          createIfNotExists: true,
        });
        testContract = await fixtures.createContract(
          testUser.id,
          testMentorUser.id,
          catalogData.product.id,
        );
        console.log(`✅ Created test contract: ${testContract.contractNumber}`);
      }

      // Try to find existing mentor payable ledger for this contract
      const existingLedger = await findExistingMentorPayableLedger(
        mentorPayableService,
        testContract.id,
        db,
      );

      if (existingLedger && existingLedger.status === "pending") {
        console.log(
          `✅ Found existing suitable mentor payable ledger: ${existingLedger.id}`,
        );
        testMentorPayableLedger = existingLedger;
      } else {
        // Create mentor price configuration before creating ledger (price = 100 for the base ledger)
        console.log("💰 Creating mentor price configuration...");
        await mentorPayableService.createMentorPrice({
          mentorUserId: testMentorUser.id,
          serviceTypeCode: "test-service",
          billingMode: "per_session",
          price: 100, // Set price to 100 to match test expectations
          currency: "USD",
          status: "active",
          updatedBy: testUser.id,
        });
        console.log("✅ Mentor price created");

        // Create new mentor payable ledger if no suitable one exists
        console.log("💰 Creating new test mentor payable ledger...");
        const perSessionBilling = await mentorPayableService.createPerSessionBilling({
          sessionId: `test-session-${Date.now()}`,
          contractId: testContract.id,
          mentorUserId: testMentorUser.id,
          studentUserId: testUser.id,
          serviceTypeCode: "test-service",
          serviceName: "Test Service",
          durationHours: 1,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000), // 1 hour later
        });
        testMentorPayableLedger = perSessionBilling;
        console.log(
          `✅ Created test mentor payable ledger: ${testMentorPayableLedger.id}`,
        );
      }
    } catch (error) {
      console.error("❌ Failed to initialize test module:", error);
      // Ensure cleanup if initialization fails
      if (app) {
        await app.close().catch(() => {});
      }
      throw error; // Re-throw to let test framework capture the error
    }
  }, 60000); // 设置60秒超时

  afterEach(async () => {
    // Phase 2: Test case cleanup - clean temporary data without table deletion
    if (fixtures) {
      console.log("🧹 Cleaning up temporary financial test data...");
      await fixtures.cleanupTemporaryData();
      console.log("✅ Temporary financial data cleaned (soft deleted)");
    }
  });

  afterAll(async () => {
    // Phase 3: Environment reset - restore state without deleting original data
    if (fixtures) {
      console.log("🔄 Resetting financial environment state...");
      await fixtures.resetEnvironmentState();
      console.log("✅ Financial environment state reset");
    }

    if (app) {
      await app.close();
    }
  });

  describe("Financial Data Reuse and Management", () => {
    it("should reuse existing financial data when available", async () => {
      // Verify we're using existing financial data
      expect(testMentorPayableLedger).toBeDefined();
      expect(testMentorPayableLedger.mentorUserId).toBe(testMentorUser.id);
      expect((testMentorPayableLedger as any).status).toBe("pending");
      expect(testMentorPayableLedger.serviceTypeCode).toBe("test-service");

      console.log(`Reusing mentor payable ledger: ${testMentorPayableLedger.id}`);
    });

    it("should create per-session billing without affecting existing data", async () => {
      // Use unique service type to avoid price conflicts
      const uniqueServiceType = `test-service-${Date.now()}`;

      // Create a new price configuration with price = 150 for this test
      await mentorPayableService.createMentorPrice({
        mentorUserId: testMentorUser.id,
        serviceTypeCode: uniqueServiceType,
        billingMode: "per_session",
        price: 150, // Price = 150 for this test
        currency: "USD",
        status: "active",
        updatedBy: testUser.id,
      });

      // Create a new per-session billing record using the new price
      const perSessionBilling = await mentorPayableService.createPerSessionBilling({
        sessionId: `test-session-${Date.now()}-${Math.random()}`,
        contractId: testContract.id,
        mentorUserId: testMentorUser.id,
        studentUserId: testUser.id,
        serviceTypeCode: uniqueServiceType,
        serviceName: "Test Service",
        durationHours: 1,
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000), // 1 hour later
      });

      expect(perSessionBilling).toBeDefined();
      expect(perSessionBilling.mentorUserId).toBe(testMentorUser.id);
      expect(perSessionBilling.totalAmount).toBe(150);
      expect(perSessionBilling.currency).toBe("USD");
      expect((perSessionBilling as any).status).toBe("pending");
      expect(perSessionBilling.serviceTypeCode).toBe(uniqueServiceType);

      console.log(`Created new per-session billing: ${perSessionBilling.id}`);

      // Verify original ledger is still intact
      const ledgers = await mentorPayableService.queryMentorPayableLedgers({
        mentorUserId: testMentorUser.id,
        page: 1,
        pageSize: 10
      });
      const originalLedger = ledgers.data.find(l => l.id === testMentorPayableLedger.id);
      expect(originalLedger?.status).toBe("pending");
      expect(originalLedger?.totalAmount).toBe(100);
    });

    it("should create package billing without affecting existing data", async () => {
      // Use unique service type to avoid conflicts
      const uniqueServiceType = `test-package-service-${Date.now()}`;

      // Create price configuration for test-package-service before creating billing
      await mentorPayableService.createMentorPrice({
        mentorUserId: testMentorUser.id,
        serviceTypeCode: uniqueServiceType,
        billingMode: "one_time",
        price: 100,
        currency: "USD",
        status: "active",
        updatedBy: testUser.id,
      });

      // Create a new package billing record with valid UUID package ID
      const packageBilling = await mentorPayableService.createPackageBilling({
        contractId: testContract.id,
        servicePackageId: testContract.id, // Use contract ID as valid UUID
        mentorUserId: testMentorUser.id,
        studentUserId: testUser.id,
        serviceTypeCode: uniqueServiceType,
        serviceName: "Test Package Service",
        quantity: 10,
      });

      expect(packageBilling).toBeDefined();
      expect(packageBilling.mentorUserId).toBe(testMentorUser.id);
      expect(packageBilling.totalAmount).toBe(1000);
      expect(packageBilling.currency).toBe("USD");
      expect((packageBilling as any).status).toBe("pending");
      expect(packageBilling.serviceTypeCode).toBe(uniqueServiceType);

      console.log(`Created new package billing: ${packageBilling.id}`);
    });

    it("should adjust payable ledger without affecting other records", async () => {
      // Get the latest ledger record for this mentor
      const ledgers = await mentorPayableService.queryMentorPayableLedgers({
        mentorUserId: testMentorUser.id,
        page: 1,
        pageSize: 10,
      });
      const originalLedger = ledgers.data.find((l) => l.id === testMentorPayableLedger.id);

      expect(originalLedger).toBeDefined();

      // Create an adjustment for this ledger (adjustmentAmount = -25 means discount of 25)
      const adjustment = await mentorPayableService.adjustPayableLedger({
        ledgerId: originalLedger!.id,
        adjustmentAmount: -25,
        reason: "Test adjustment - discount",
        createdBy: testUser.id,
      });

      expect(adjustment).toBeDefined();
      expect(adjustment.id).toBeDefined();
      // Adjustment record stores the adjustment amount (-25), not the final total
      expect(adjustment.totalAmount).toBe(-25);
      expect((adjustment as any).status).toBe("adjusted");
      expect(adjustment.adjustmentReason).toBe("Test adjustment - discount");

      console.log(`Created ledger adjustment: ${adjustment.id}`);

      // Verify original ledger is unaffected (still 100)
      const ledgersAfterAdjustment = await mentorPayableService.queryMentorPayableLedgers({
        mentorUserId: testMentorUser.id,
        page: 1,
        pageSize: 10
      });
      const originalLedgerAfterAdjustment = ledgersAfterAdjustment.data.find(l => l.id === testMentorPayableLedger.id);
      expect(originalLedgerAfterAdjustment?.totalAmount).toBe(100);

      // Adjustment record should have the adjustment amount (-25)
      const adjustmentLedger = ledgersAfterAdjustment.data.find(l => l.id === adjustment.id);
      expect(adjustmentLedger).toBeDefined();
      expect(adjustmentLedger?.totalAmount).toBe(-25);
      expect(adjustmentLedger?.status).toBe("adjusted");
    });

    it("should verify financial data isolation", async () => {
      // This test verifies that our changes don't affect other financial data

      const contractLedgers = await mentorPayableService.queryMentorPayableLedgers({
        mentorUserId: testMentorUser.id,
        page: 1,
        pageSize: 50
      });
      expect(contractLedgers.data.length).toBeGreaterThanOrEqual(2); // Original + new ones

      // Verify each ledger maintains its integrity
      for (const ledger of contractLedgers.data) {
        expect(ledger.mentorUserId).toBe(testMentorUser.id);
        expect((ledger as any).status).toBeDefined();
        expect(ledger.totalAmount).toBeDefined();
        expect(ledger.currency).toBeDefined();
        expect(ledger.serviceTypeCode).toBeDefined();
      }

      console.log(
        `Verified financial data isolation for ${contractLedgers.data.length} mentor payable ledgers`,
      );
    });
  });
});

/**
 * Helper function to find existing suitable contract for student
 * Implements data reuse principle
 */
async function findExistingContractForStudent(
  studentUserId: string,
  database: NodePgDatabase<typeof schema>,
): Promise<typeof schema.contracts.$inferSelect | null> {
  try {
    // Look for existing contracts for this student
    const contracts = await database.select()
      .from(schema.contracts)
      .where(eq(schema.contracts.studentId, studentUserId));

    if (contracts && contracts.length > 0) {
      // Return the most recent active contract
      const activeContract = contracts.find((c) => c.status === "active");
      return activeContract || contracts[0];
    }

    return null;
  } catch (_error) {
    console.log("No existing suitable contract found for student, will create new one");
    return null;
  }
}

/**
 * Helper function to find existing suitable mentor payable ledger
 * Implements data reuse principle
 */
async function findExistingMentorPayableLedger(
  mentorPayableService: IMentorPayableService,
  contractId: string,
  database: NodePgDatabase<typeof schema>,
): Promise<IMentorPayableLedger | null> {
  try {
    // Query ledgers for the contract
    const allLedgers = await database.select()
      .from(schema.mentorPayableLedgers)
      .where(eq(schema.mentorPayableLedgers.relationId, contractId));

    if (allLedgers && allLedgers.length > 0) {
      // Find a pending ledger
      const suitableLedger = allLedgers.find(
        (l) => (l as any).status === "pending",
      );
      return suitableLedger ? suitableLedger as unknown as IMentorPayableLedger : null;
    }

    return null;
  } catch (_error) {
    console.log("No existing suitable mentor payable ledger found, will create new one");
    return null;
  }
}
