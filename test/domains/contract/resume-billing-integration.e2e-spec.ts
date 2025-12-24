import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DatabaseModule } from "@infrastructure/database/database.module";
import * as schema from "@infrastructure/database/schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { ConfigModule } from "@nestjs/config";

// Domain modules
import { ContractModule } from "@domains/contract/contract.module";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { ResumeBillCancelledListener } from "@application/events/handlers/contract/resume-bill-cancelled-listener";
import { ResumeBilledListener } from "@application/events/handlers/contract/resume-billed-listener";

// Event types
import { ResumeBillCancelledEvent, ResumeBilledEvent } from "@application/events";

/**
 * Integration Test: Resume Billing Flow
 * 集成测试：简历计费流程
 *
 * Tests end-to-end flow of:
 * 1. Resume billed event → Record consumption
 * 2. Resume bill cancelled event → Record refund
 * 3. Verify ledger entries and balance changes
 */
describe("Resume Billing Integration Test [简历计费集成测试]", () => {
  let module: TestingModule;
  let eventEmitter: EventEmitter2;
  let db: NodePgDatabase<typeof schema>;
  let _serviceLedgerService: ServiceLedgerService;

  // Test data
  const testStudentId = "test-student-123";
  const testMentorId = "test-mentor-456";
  const testResumeId = "test-resume-789";
  const testServiceType = "resume_review";

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        EventEmitterModule.forRoot(),
        DatabaseModule,
        ContractModule,
      ],
      providers: [ResumeBilledListener, ResumeBillCancelledListener],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    _serviceLedgerService = module.get<ServiceLedgerService>(ServiceLedgerService);
    db = module.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  }, 30000);

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(schema.serviceLedgers)
      .where(eq(schema.serviceLedgers.studentId, testStudentId));

    await db.delete(schema.contractServiceEntitlements)
      .where(eq(schema.contractServiceEntitlements.studentId, testStudentId));
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.serviceLedgers)
      .where(eq(schema.serviceLedgers.studentId, testStudentId));

    await db.delete(schema.contractServiceEntitlements)
      .where(eq(schema.contractServiceEntitlements.studentId, testStudentId));

    await module.close();
  });

  describe("End-to-End Resume Billing Flow [端到端简历计费流程]", () => {
    it("should complete full billing and cancellation cycle [应该完成完整的计费和取消周期]", async () => {
      console.log("\n=== Starting Resume Billing Integration Test ===\n");

      // Step 1: Create test entitlement
      console.log("📝 Step 1: Create test entitlement with 5 resume review units");
      await db.insert(schema.contractServiceEntitlements).values({
        id: "test-entitlement-1",
        studentId: testStudentId,
        serviceType: testServiceType,
        totalQuantity: 5,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 5,
      });

      const [initialEntitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(eq(schema.contractServiceEntitlements.id, "test-entitlement-1"));

      console.log("✅ Initial entitlement:", {
        total: initialEntitlement.totalQuantity,
        consumed: initialEntitlement.consumedQuantity,
        available: initialEntitlement.availableQuantity,
      });

      // Step 2: Emit resume billed event
      console.log("\n📨 Step 2: Emit RESUME_BILLED_EVENT");
      const billedEvent = new ResumeBilledEvent({
        resumeId: testResumeId,
        studentId: testStudentId,
        mentorId: testMentorId,
        jobTitle: "Senior Software Engineer",
        description: "Resume review for FAANG application",
        billedAt: new Date(),
      });

      eventEmitter.emit(ResumeBilledEvent.eventType, billedEvent);

      // Wait for async event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 3: Verify consumption was recorded
      console.log("\n✅ Step 3: Verify consumption ledger entry");
      const [consumptionLedger] = await db
        .select()
        .from(schema.serviceLedgers)
        .where(
          eq(schema.serviceLedgers.relatedBookingId, testResumeId),
        );

      expect(consumptionLedger).toBeDefined();
      expect(consumptionLedger.type).toBe("consumption");
      expect(consumptionLedger.source).toBe("booking_completed");
      expect(consumptionLedger.quantity).toBe(-1); // Consumption is negative
      expect(consumptionLedger.serviceType).toBe(testServiceType);
      expect(consumptionLedger.studentId).toBe(testStudentId);

      console.log("✅ Consumption ledger:", {
        id: consumptionLedger.id,
        type: consumptionLedger.type,
        quantity: consumptionLedger.quantity,
        balanceAfter: consumptionLedger.balanceAfter,
      });

      // Step 4: Verify entitlement was updated
      console.log("\n📊 Step 4: Verify entitlement after billing");
      const [afterBillingEntitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(eq(schema.contractServiceEntitlements.id, "test-entitlement-1"));

      expect(afterBillingEntitlement.consumedQuantity).toBe(1);
      expect(afterBillingEntitlement.availableQuantity).toBe(4); // 5 - 1

      console.log("✅ Entitlement after billing:", {
        total: afterBillingEntitlement.totalQuantity,
        consumed: afterBillingEntitlement.consumedQuantity,
        available: afterBillingEntitlement.availableQuantity,
      });

      // Step 5: Emit resume bill cancelled event
      console.log("\n📨 Step 5: Emit resume bill cancelled event");
      const cancelledEvent = new ResumeBillCancelledEvent({
        resumeId: testResumeId,
        studentId: testStudentId,
        mentorId: testMentorId,
        jobTitle: "Senior Software Engineer",
        description: "Cancelled due to student request",
        cancelledAt: new Date(),
      });

      eventEmitter.emit(ResumeBillCancelledEvent.eventType, cancelledEvent);

      // Wait for async event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 6: Verify refund was recorded
      console.log("\n✅ Step 6: Verify refund ledger entry");
      const refundLedgers = await db
        .select()
        .from(schema.serviceLedgers)
        .where(
          eq(schema.serviceLedgers.relatedBookingId, testResumeId),
        );

      expect(refundLedgers.length).toBe(2); // 1 consumption + 1 refund

      const refundLedger = refundLedgers.find((l) => l.type === "refund");
      expect(refundLedger).toBeDefined();
      expect(refundLedger!.type).toBe("refund");
      expect(refundLedger!.source).toBe("booking_cancelled");
      expect(refundLedger!.quantity).toBe(1); // Refund is positive
      expect(refundLedger!.serviceType).toBe(testServiceType);
      expect(refundLedger!.studentId).toBe(testStudentId);
      expect(refundLedger!.metadata).toBeDefined();
      expect(refundLedger!.metadata.bookingSource).toBe("resumes");

      console.log("✅ Refund ledger:", {
        id: refundLedger!.id,
        type: refundLedger!.type,
        quantity: refundLedger!.quantity,
        balanceAfter: refundLedger!.balanceAfter,
        metadata: refundLedger!.metadata,
      });

      // Step 7: Verify entitlement was updated after refund
      console.log("\n📊 Step 7: Verify entitlement after cancellation");
      const [afterRefundEntitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(eq(schema.contractServiceEntitlements.id, "test-entitlement-1"));

      expect(afterRefundEntitlement.consumedQuantity).toBe(0); // Back to 0 after refund
      expect(afterRefundEntitlement.availableQuantity).toBe(5); // Back to 5

      console.log("✅ Entitlement after refund:", {
        total: afterRefundEntitlement.totalQuantity,
        consumed: afterRefundEntitlement.consumedQuantity,
        available: afterRefundEntitlement.availableQuantity,
      });

      console.log("\n=== Resume Billing Integration Test Complete ===\n");
    });

    it("should handle multiple billing events correctly [应该正确处理多个计费事件]", async () => {
      console.log("\n=== Starting Multiple Billing Events Test ===\n");

      // Create test entitlement with 10 units
      await db.insert(schema.contractServiceEntitlements).values({
        id: "test-entitlement-2",
        studentId: testStudentId,
        serviceType: testServiceType,
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
      });

      // Submit 3 resumes
      const resumeIds = ["resume-1", "resume-2", "resume-3"];
      for (let i = 0; i < 3; i++) {
        const event = new ResumeBilledEvent({
          resumeId: resumeIds[i],
          studentId: testStudentId,
          mentorId: testMentorId,
          jobTitle: `Job ${i + 1}`,
          billedAt: new Date(),
        });

        eventEmitter.emit(ResumeBilledEvent.eventType, event);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Wait for all events to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify all consumptions were recorded
      const ledgers = await db
        .select()
        .from(schema.serviceLedgers)
        .where(eq(schema.serviceLedgers.studentId, testStudentId));

      expect(ledgers.length).toBe(3);
      ledgers.forEach((ledger) => {
        expect(ledger.type).toBe("consumption");
        expect(ledger.quantity).toBe(-1);
        expect(ledger.serviceType).toBe(testServiceType);
      });

      // Verify entitlement was updated correctly
      const [entitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(eq(schema.contractServiceEntitlements.id, "test-entitlement-2"));

      expect(entitlement.consumedQuantity).toBe(3);
      expect(entitlement.availableQuantity).toBe(7); // 10 - 3

      console.log("✅ Multiple billing events processed successfully");
      console.log("  - Total consumptions:", ledgers.length);
      console.log("  - Consumed quantity:", entitlement.consumedQuantity);
      console.log("  - Available quantity:", entitlement.availableQuantity);
    });
  });
});
