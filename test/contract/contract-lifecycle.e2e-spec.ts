import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ContractModule } from "@domains/contract/contract.module";
import { ContractService } from "@domains/contract/services/contract.service";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { createTestFixtures, TestFixtures } from "../utils/test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import {
  ServiceType,
  BillingMode,
  Currency,
  ProductItemType,
} from "@domains/catalog/common/interfaces/enums";

describe("Contract Lifecycle E2E Tests (Real Database)", () => {
  let app: INestApplication;
  let contractService: ContractService;
  let holdService: ServiceHoldService;
  let ledgerService: ServiceLedgerService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;

  // Test data IDs
  let testUserId: string;
  let testProductId: string;
  let testServiceId1: string;
  let testServiceId2: string;
  let testServiceId3: string;
  let testPackageId: string;

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
    fixtures = createTestFixtures(db);

    // Clean up and create test data
    await fixtures.cleanupAll();

    // Create test user
    const user = await fixtures.createUser({
      email: "contract-test@example.com",
      nickname: "contracttester",
    });
    testUserId = user.id;

    // Create test services
    const service1 = await fixtures.createService(testUserId, {
      code: `RESUME-REVIEW-${Date.now()}`,
      serviceType: ServiceType.RESUME_REVIEW,
      name: "Resume Review Service",
      billingMode: BillingMode.ONE_TIME,
      status: "active",
    });
    testServiceId1 = service1.id;

    const service2 = await fixtures.createService(testUserId, {
      code: `MOCK-INTERVIEW-${Date.now()}`,
      serviceType: ServiceType.MOCK_INTERVIEW,
      name: "Mock Interview Service",
      billingMode: BillingMode.ONE_TIME,
      status: "active",
    });
    testServiceId2 = service2.id;

    const service3 = await fixtures.createService(testUserId, {
      code: `SESSION-${Date.now()}`,
      serviceType: ServiceType.SESSION,
      name: "Session Service",
      billingMode: BillingMode.ONE_TIME,
      status: "active",
    });
    testServiceId3 = service3.id;

    // Create test service package
    const servicePackage = await fixtures.createServicePackage(
      testUserId,
      [testServiceId2, testServiceId3],
      {
        code: `INTERVIEW-BUNDLE-${Date.now()}`,
        name: "Interview Prep Bundle",
        status: "active",
      },
    );
    testPackageId = servicePackage.id;

    // Create test product with services and package
    const product = await fixtures.createProduct(
      testUserId,
      [
        {
          type: ProductItemType.SERVICE,
          referenceId: testServiceId1,
          quantity: 5, // 5 resume reviews
        },
        {
          type: ProductItemType.SERVICE_PACKAGE,
          referenceId: testPackageId,
          quantity: 1, // 1 interview bundle
        },
      ],
      {
        code: `CAREER-PKG-${Date.now()}`,
        name: "Career Counseling Package",
        price: "2000.00",
        currency: Currency.USD,
        validityDays: 365,
        status: "active",
      },
    );
    testProductId = product.id;
  });

  afterAll(async () => {
    await fixtures.cleanupAll();
    await app.close();
  });

  describe("Full Contract Lifecycle", () => {
    let contractId: string;
    let holdId: string;

    it("Step 1: Create contract (signed status)", async () => {
      const contract = await fixtures.createContract(
        testUserId,
        testUserId,
        testProductId,
      );

      expect(contract).toBeDefined();
      expect(contract.id).toBeDefined();
      expect(contract.contractNumber).toMatch(/^CONTRACT-\d{4}-\d{2}-\d{5}$/);
      expect(contract.status).toBe("signed");
      expect(contract.totalAmount).toBe("2000.00");
      expect(contract.productSnapshot).toBeDefined();
      expect(contract.productSnapshot.items).toBeDefined();
      expect(contract.productSnapshot.items.length).toBe(2);

      contractId = contract.id;
    });

    it("Step 2: Activate contract", async () => {
      const activated = await contractService.activate(contractId);

      expect(activated.status).toBe("active");
      expect(activated.activatedAt).toBeDefined();
    });

    it("Step 3: Verify entitlements are created correctly", async () => {
      // Check resume review entitlement (5 from service)
      const resumeBalance = await ledgerService.calculateAvailableBalance(
        contractId,
        ServiceType.RESUME_REVIEW,
      );

      expect(resumeBalance.totalQuantity).toBe(5);
      expect(resumeBalance.availableQuantity).toBe(5);

      // Check mock interview entitlement (from package)
      const mockInterviewBalance =
        await ledgerService.calculateAvailableBalance(
          contractId,
          ServiceType.MOCK_INTERVIEW,
        );

      expect(mockInterviewBalance.totalQuantity).toBeGreaterThan(0);

      // Check session entitlement (from package)
      const sessionBalance = await ledgerService.calculateAvailableBalance(
        contractId,
        ServiceType.SESSION,
      );

      expect(sessionBalance.totalQuantity).toBeGreaterThan(0);
    });

    it("Step 4: Create hold for booking", async () => {
      const holdDto = {
        contractId,
        studentId: testUserId,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 1,
        relatedBookingId: `booking-${Date.now()}`,
        createdBy: testUserId,
      };

      const hold = await holdService.createHold(holdDto);

      expect(hold).toBeDefined();
      expect(hold.status).toBe("active");
      expect(hold.quantity).toBe(1);
      expect(hold.expiresAt).toBeDefined();

      holdId = hold.id; // Save hold ID for later use
    });

    it("Step 5: Check available balance (should be reduced by hold)", async () => {
      const balance = await ledgerService.calculateAvailableBalance(
        contractId,
        ServiceType.RESUME_REVIEW,
      );

      // Total: 5, Consumed: 0, Held: 1, Available: 4
      expect(balance.totalQuantity).toBe(5);
      expect(balance.consumedQuantity).toBe(0);
      expect(balance.heldQuantity).toBe(1);
      expect(balance.availableQuantity).toBe(4);
    });

    it("Step 6: Consume service (complete booking)", async () => {
      const consumeDto = {
        contractId,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 1,
        sessionId: `session-${Date.now()}`,
        holdId, // Include hold ID to release it
        createdBy: testUserId,
      };

      await contractService.consumeService(consumeDto);

      const balance = await ledgerService.calculateAvailableBalance(
        contractId,
        ServiceType.RESUME_REVIEW,
      );

      // After consumption: Total: 5, Consumed: 1, Held: 0 (released), Available: 4
      expect(balance.totalQuantity).toBe(5);
      expect(balance.consumedQuantity).toBe(1);
      expect(balance.availableQuantity).toBe(4);
    });

    it("Step 7: Record manual adjustment (compensation)", async () => {
      const adjustmentDto = {
        contractId,
        studentId: testUserId,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 2,
        reason: "Service quality issue compensation",
        createdBy: testUserId,
      };

      const ledger = await ledgerService.recordAdjustment(adjustmentDto);

      expect(ledger.quantity).toBe(2); // Positive adjustment
      expect(ledger.type).toBe("adjustment");
      expect(ledger.reason).toBe("Service quality issue compensation");
    });

    it("Step 8: Verify ledger history", async () => {
      const ledgers = await ledgerService.queryLedgers({
        contractId,
        serviceType: ServiceType.RESUME_REVIEW,
      });

      // Should have: 1 consumption + 1 adjustment = at least 2 records
      expect(ledgers.length).toBeGreaterThanOrEqual(2);

      const consumptionRecords = ledgers.filter(
        (l) => l.type === "consumption",
      );
      const adjustmentRecords = ledgers.filter((l) => l.type === "adjustment");

      expect(consumptionRecords.length).toBeGreaterThanOrEqual(1);
      expect(adjustmentRecords.length).toBeGreaterThanOrEqual(1);
    });

    it("Step 9: Reconcile balance consistency", async () => {
      const isConsistent = await ledgerService.reconcileBalance(
        contractId,
        ServiceType.RESUME_REVIEW,
      );

      expect(isConsistent).toBe(true);
    });

    it("Step 10: Suspend contract", async () => {
      const suspended = await contractService.suspend(
        contractId,
        "Payment issue",
        testUserId,
      );

      expect(suspended.status).toBe("suspended");
      expect(suspended.suspendedAt).toBeDefined();
    });

    it("Step 11: Resume contract", async () => {
      const resumed = await contractService.resume(contractId, testUserId);

      expect(resumed.status).toBe("active");
      expect(resumed.suspendedAt).toBeNull();
    });

    it("Step 12: Complete contract", async () => {
      const completed = await contractService.complete(contractId, testUserId);

      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeDefined();
    });
  });

  describe("Error Scenarios", () => {
    let errorTestContractId: string;

    beforeAll(async () => {
      // Create a contract with limited services for error testing
      const smallProduct = await fixtures.createProduct(
        testUserId,
        [
          {
            type: ProductItemType.SERVICE,
            referenceId: testServiceId1,
            quantity: 2, // Only 2 services
          },
        ],
        {
          code: `SMALL-PKG-${Date.now()}`,
          name: "Small Package",
          price: "500.00",
          currency: Currency.USD,
          validityDays: 30,
          status: "active",
        },
      );

      const contract = await fixtures.createContract(
        testUserId,
        testUserId,
        smallProduct.id,
      );
      errorTestContractId = contract.id;
      await contractService.activate(errorTestContractId);
    });

    it("should throw error when consuming more than available", async () => {
      const consumeDto = {
        contractId: errorTestContractId,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 5, // More than available (2)
        sessionId: `session-err-${Date.now()}`,
        createdBy: testUserId,
      };

      await expect(contractService.consumeService(consumeDto)).rejects.toThrow(
        "Insufficient service balance",
      );
    });

    it("should throw error when activating non-signed contract", async () => {
      // Contract is already active, cannot activate again
      await expect(
        contractService.activate(errorTestContractId),
      ).rejects.toThrow("Contract is not in draft status");
    });
  });

  describe("Hold Expiration Flow", () => {
    it("should manage holds correctly", async () => {
      const holdContract = await fixtures.createContract(
        testUserId,
        testUserId,
        testProductId,
      );
      await contractService.activate(holdContract.id);

      // Create hold
      const holdDto = {
        contractId: holdContract.id,
        studentId: testUserId,
        serviceType: ServiceType.RESUME_REVIEW,
        quantity: 1,
        relatedBookingId: `booking-hold-${Date.now()}`,
        createdBy: testUserId,
      };

      const hold = await holdService.createHold(holdDto);
      expect(hold.status).toBe("active");

      // Run cleanup (in real scenario, this runs every 5 minutes)
      const expiredCount = await holdService.expireHolds();

      // Newly created hold shouldn't be expired yet (TTL is 15 minutes)
      expect(expiredCount).toBe(0);

      const activeHolds = await holdService.getActiveHolds(
        holdContract.id,
        ServiceType.RESUME_REVIEW,
      );

      expect(activeHolds.length).toBeGreaterThanOrEqual(1);
    });
  });
});
