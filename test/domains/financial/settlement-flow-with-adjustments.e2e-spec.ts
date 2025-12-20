import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { EventingModule } from "@infrastructure/eventing/eventing.module";
import { SettlementService } from "@domains/financial/services/settlement.service";
import { MentorPaymentInfoService } from "@domains/financial/services/mentor-payment-info.service";
import { FinancialModule } from "@domains/financial/financial.module";
import { SettlementMethod } from "@domains/financial/dto/settlement/settlement.enums";
import { v4 as uuidv4 } from "uuid";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import { sql, eq } from "drizzle-orm";

/**
 * Settlement Flow with Adjustments E2E Tests
 * Comprehensive test suite for settlement generation including adjustment ledgers
 *
 * Test Coverage:
 * 1. Settlement with only original ledgers
 * 2. Settlement with only adjustment ledgers
 * 3. Settlement with mixed original and adjustment ledgers
 * 4. Month filter validation
 * 5. SettlementId update on adjustment ledgers
 * 6. Amount calculation with adjustments
 */
describe("Settlement Flow with Adjustments (e2e)", () => {
  let app: INestApplication;
  let settlementService: SettlementService;
  let paymentInfoService: MentorPaymentInfoService;
  let db: NodePgDatabase<typeof schema>;

  const testMentorId = uuidv4();
  const testStudentId = uuidv4();
  const testSessionId = uuidv4();
  const createdBy = "test-user";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env.test",
          isGlobal: true,
        }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: ".",
        }),
        EventingModule,
        DatabaseModule,
        FinancialModule,
      ],
    }).compile();

    settlementService = moduleFixture.get<SettlementService>("ISettlementService");
    paymentInfoService = moduleFixture.get<MentorPaymentInfoService>("IMentorPaymentInfoService");
    db = moduleFixture.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(schema.settlementDetails).where(
      sql`${schema.settlementDetails.mentorPayableId} IN (
        SELECT ${schema.mentorPayableLedgers.id}
        FROM ${schema.mentorPayableLedgers}
        WHERE ${schema.mentorPayableLedgers.mentorId} = ${testMentorId}
      )`,
    );
    await db.delete(schema.settlementLedgers).where(
      eq(schema.settlementLedgers.mentorId, testMentorId),
    );
    await db.delete(schema.mentorPayableLedgers).where(
      eq(schema.mentorPayableLedgers.mentorId, testMentorId),
    );
    await db.delete(schema.mentorPaymentInfos).where(
      eq(schema.mentorPaymentInfos.mentorId, testMentorId),
    );
  });

  describe("Settlement with Adjustment Ledgers", () => {
    it("should include adjustment ledgers in settlement generation", async () => {
      // Step 1: Create mentor payment info
      await paymentInfoService.createOrUpdateMentorPaymentInfo({
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
        paymentDetails: {
          bankName: "Test Bank",
          accountNumber: "1234567890",
          accountHolder: "Test Mentor",
        },
      });

      // Step 2: Create original payable ledger
      const [originalLedger] = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "100.0",
          amount: "100.00",
          currency: "USD",
          originalId: null,
          createdBy,
        })
        .returning();

      // Step 3: Create positive adjustment ledger (e.g., bonus)
      const [adjustmentLedger] = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "50.0",
          amount: "50.00",
          currency: "USD",
          originalId: originalLedger.id,
          adjustmentReason: "Performance bonus",
          createdBy,
        })
        .returning();

      // Step 4: Generate settlement for the month
      const settlementMonth = "2025-07";
      const settlement = await settlementService.generateSettlement(
        {
          mentorId: testMentorId,
          settlementMonth,
          exchangeRate: 1.0,
          deductionRate: 0.1, // 10% deduction
        },
        createdBy,
      );

      // Step 5: Verify settlement includes both original and adjustment
      expect(settlement.originalAmount).toBe(150); // 100 + 50
      expect(settlement.targetAmount).toBe(135); // (100 + 50) * 0.9

      // Step 6: Verify both ledgers have settlementId set
      const updatedOriginalLedger = await db.query.mentorPayableLedgers.findFirst({
        where: eq(schema.mentorPayableLedgers.id, originalLedger.id),
      });

      const updatedAdjustmentLedger = await db.query.mentorPayableLedgers.findFirst({
        where: eq(schema.mentorPayableLedgers.id, adjustmentLedger.id),
      });

      expect(updatedOriginalLedger?.settlementId).toBe(settlement.id);
      expect(updatedAdjustmentLedger?.settlementId).toBe(settlement.id);

      // Step 7: Verify settlement details
      const details = await db.query.settlementDetails.findMany({
        where: eq(schema.settlementDetails.settlementId, settlement.id),
      });

      expect(details.length).toBe(2);
    }, 30000);

    it("should include only adjustment ledgers when no original ledgers exist", async () => {
      await paymentInfoService.createOrUpdateMentorPaymentInfo({
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
        paymentDetails: {
          bankName: "Test Bank",
          accountNumber: "1234567890",
          accountHolder: "Test Mentor",
        },
      });

      // Create adjustment ledger without original
      const [adjustmentLedger] = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "25.0",
          amount: "25.00",
          currency: "USD",
          originalId: uuidv4(), // References non-existent original (edge case)
          adjustmentReason: "Manual adjustment",
          createdBy,
        })
        .returning();

      const settlementMonth = "2025-07";
      const settlement = await settlementService.generateSettlement(
        {
          mentorId: testMentorId,
          settlementMonth,
          exchangeRate: 1.0,
          deductionRate: 0.0,
        },
        createdBy,
      );

      expect(settlement.originalAmount).toBe(25);

      const updatedAdjustmentLedger = await db.query.mentorPayableLedgers.findFirst({
        where: eq(schema.mentorPayableLedgers.id, adjustmentLedger.id),
      });

      expect(updatedAdjustmentLedger?.settlementId).toBe(settlement.id);
    }, 30000);

    it("should handle negative adjustment (deduction) correctly", async () => {
      await paymentInfoService.createOrUpdateMentorPaymentInfo({
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
        paymentDetails: {
          bankName: "Test Bank",
          accountNumber: "1234567890",
          accountHolder: "Test Mentor",
        },
      });

      const [originalLedger] = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "200.0",
          amount: "200.00",
          currency: "USD",
          originalId: null,
          createdBy,
        })
        .returning();

      // Create negative adjustment
      await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "30.0",
          amount: "-30.00",
          currency: "USD",
          originalId: originalLedger.id,
          adjustmentReason: "Penalty for late submission",
          createdBy,
        })
        .returning();

      const settlementMonth = "2025-07";
      const settlement = await settlementService.generateSettlement(
        {
          mentorId: testMentorId,
          settlementMonth,
          exchangeRate: 1.0,
          deductionRate: 0.05, // 5% deduction
        },
        createdBy,
      );

      // 200 - 30 = 170, then 170 * 0.95 = 161.5
      expect(settlement.originalAmount).toBe(170);
      expect(settlement.targetAmount).toBeCloseTo(161.5, 2);
    }, 30000);
  });

  describe("Settlement Month Filter", () => {
    it("should only include ledgers from the specified month (2025-07)", async () => {
      await paymentInfoService.createOrUpdateMentorPaymentInfo({
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
        paymentDetails: {
          bankName: "Test Bank",
          accountNumber: "1234567890",
          accountHolder: "Test Mentor",
        },
      });

      // Create ledgers in different months
      const juneLedger = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "100.0",
          amount: "100.00",
          currency: "USD",
          originalId: null,
          createdBy,
          createdAt: new Date("2025-06-15"),
        })
        .returning();

      const julyLedger = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "200.0",
          amount: "200.00",
          currency: "USD",
          originalId: null,
          createdBy,
          createdAt: new Date("2025-07-15"),
        })
        .returning();

      const augustLedger = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "300.0",
          amount: "300.00",
          currency: "USD",
          originalId: null,
          createdBy,
          createdAt: new Date("2025-08-15"),
        })
        .returning();

      // Generate settlement for July
      const settlement = await settlementService.generateSettlement(
        {
          mentorId: testMentorId,
          settlementMonth: "2025-07",
          exchangeRate: 1.0,
          deductionRate: 0.0,
        },
        createdBy,
      );

      // Should only include July ledger
      expect(settlement.originalAmount).toBe(200);

      // Verify only July ledger is marked as settled
      const updatedJuneLedger = await db.query.mentorPayableLedgers.findFirst({
        where: eq(schema.mentorPayableLedgers.id, juneLedger[0].id),
      });
      const updatedJulyLedger = await db.query.mentorPayableLedgers.findFirst({
        where: eq(schema.mentorPayableLedgers.id, julyLedger[0].id),
      });
      const updatedAugustLedger = await db.query.mentorPayableLedgers.findFirst({
        where: eq(schema.mentorPayableLedgers.id, augustLedger[0].id),
      });

      expect(updatedJuneLedger?.settlementId).toBeNull();
      expect(updatedJulyLedger?.settlementId).toBe(settlement.id);
      expect(updatedAugustLedger?.settlementId).toBeNull();
    }, 30000);
  });

  describe("Edge Cases", () => {
    it("should handle zero amount after negative adjustments", async () => {
      await paymentInfoService.createOrUpdateMentorPaymentInfo({
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
        paymentDetails: {
          bankName: "Test Bank",
          accountNumber: "1234567890",
          accountHolder: "Test Mentor",
        },
      });

      const [originalLedger] = await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "100.0",
          amount: "100.00",
          currency: "USD",
          originalId: null,
          createdBy,
        })
        .returning();

      // Create large negative adjustment
      await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "100.0",
          amount: "-100.00",
          currency: "USD",
          originalId: originalLedger.id,
          adjustmentReason: "Full refund",
          createdBy,
        })
        .returning();

      const settlementMonth = "2025-07";
      const settlement = await settlementService.generateSettlement(
        {
          mentorId: testMentorId,
          settlementMonth,
          exchangeRate: 1.0,
          deductionRate: 0.0,
        },
        createdBy,
      );

      expect(settlement.originalAmount).toBe(0);
      expect(settlement.targetAmount).toBe(0);
    }, 30000);

    it("should not include already settled ledgers", async () => {
      await paymentInfoService.createOrUpdateMentorPaymentInfo({
        mentorId: testMentorId,
        paymentCurrency: "USD",
        paymentMethod: SettlementMethod.DOMESTIC_TRANSFER,
        paymentDetails: {
          bankName: "Test Bank",
          accountNumber: "1234567890",
          accountHolder: "Test Mentor",
        },
      });

      // Create already settled ledger
      await db.insert(schema.mentorPayableLedgers).values({
        mentorId: testMentorId,
        studentId: testStudentId,
        sessionTypeCode: "CONSULTATION",
        referenceId: testSessionId,
        price: "100.0",
        amount: "100.00",
        currency: "USD",
        originalId: null,
        settlementId: uuidv4(), // Already settled
        createdBy,
      });

      // Create unsettled ledger
      await db
        .insert(schema.mentorPayableLedgers)
        .values({
          mentorId: testMentorId,
          studentId: testStudentId,
          sessionTypeCode: "CONSULTATION",
          referenceId: testSessionId,
          price: "200.0",
          amount: "200.00",
          currency: "USD",
          originalId: null,
          settlementId: null,
          createdBy,
        })
        .returning();

      const settlement = await settlementService.generateSettlement(
        {
          mentorId: testMentorId,
          settlementMonth: "2025-07",
          exchangeRate: 1.0,
          deductionRate: 0.0,
        },
        createdBy,
      );

      expect(settlement.originalAmount).toBe(200);
      expect(settlement.originalAmount).not.toBe(300); // Should not include 100 from settled ledger
    }, 30000);
  });
});
