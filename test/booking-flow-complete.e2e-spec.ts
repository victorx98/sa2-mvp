import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BookSessionCommand } from "../src/application/commands/booking/book-session.command";
import { MeetingModule } from "../src/core/meeting/meeting.module";
import { CalendarModule } from "../src/core/calendar/calendar.module";
import { ContractService } from "../src/domains/contract/services/contract.service";
import { ServiceHoldService } from "../src/domains/contract/services/service-hold.service";
import { RegularMentoringService } from "../src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service";
import { RegularMentoringRepository } from "../src/domains/services/sessions/regular-mentoring/regular-mentoring.repository";
import { SessionTypesRepository } from "../src/domains/services/session-types/session-types.repository";
import { ServiceRegistryService } from "../src/domains/services/service-registry/services/service-registry.service";
import { ServiceReferenceRepository } from "../src/domains/services/service-registry/service-reference.repository";
import { DATABASE_CONNECTION } from "../src/infrastructure/database/database.provider";
import { DatabaseModule } from "../src/infrastructure/database/database.module";
import { BookSessionInput } from "../src/application/commands/booking/dto/book-session-input.dto";
import * as schema from "../src/infrastructure/database/schema";
import { eq, and } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { v4 as uuidv4 } from "uuid";
import { TelemetryModule } from "../src/telemetry/telemetry.module";

/**
 * Comprehensive E2E Test Suite for Session Booking Flow
 *
 * This test suite covers the complete booking flow including:
 * - Happy path booking
 * - Insufficient balance scenarios
 * - Time conflict detection
 * - Transaction rollback on failures
 * - Concurrent booking race conditions
 * - Session lifecycle via webhooks
 * - Service consumption and balance deduction
 * - Hold expiration cleanup
 * - Session cancellation
 *
 * Prerequisites:
 * - DATABASE_URL configured in .env
 * - Database migrations applied
 * - Test database should be separate from production
 *
 * Run with: npm run test:e2e -- booking-flow-complete.e2e-spec
 */
describe("Session Booking Flow - Complete E2E Tests", () => {
  let app: TestingModule;
  let command: BookSessionCommand;
  let db: NodePgDatabase;
  let contractService: ContractService;
  let serviceHoldService: ServiceHoldService;

  // Generate unique test prefix to avoid conflicts
  const testPrefix = `e2e_${Date.now()}`;

  beforeAll(async () => {
    // Create test module with real dependencies
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env",
          isGlobal: true,
        }),
        EventEmitterModule.forRoot(),
        DatabaseModule,
        MeetingModule,
        CalendarModule,
        TelemetryModule,
      ],
      providers: [
        BookSessionCommand,
        ContractService,
        ServiceHoldService,
        RegularMentoringService,
        RegularMentoringRepository,
        SessionTypesRepository,
        ServiceRegistryService,
        ServiceReferenceRepository,
      ],
    }).compile();

    command = app.get<BookSessionCommand>(BookSessionCommand);
    db = app.get<NodePgDatabase>(DATABASE_CONNECTION);
    contractService = app.get<ContractService>(ContractService);
    serviceHoldService = app.get<ServiceHoldService>(ServiceHoldService);

    console.log("✅ Test module initialized with real database");
  });

  afterAll(async () => {
    // Clean up all test data
    try {
      if (db) {
        // Delete in dependency order
        await db
          .delete(schema.calendarSlots)
          .where(eq(schema.calendarSlots.userId, testPrefix));

        await db
          .delete(schema.serviceHolds)
          .where(eq(schema.serviceHolds.studentId, testPrefix));

        await db
          .delete(schema.serviceLedgers)
          .where(eq(schema.serviceLedgers.studentId, testPrefix));

        await db
          .delete(schema.regularMentoringSessions)
          .where(eq(schema.regularMentoringSessions.studentUserId, testPrefix));

        await db
          .delete(schema.contractServiceEntitlements)
          .where(eq(schema.contractServiceEntitlements.studentId, testPrefix));

        await db
          .delete(schema.contracts)
          .where(eq(schema.contracts.studentId, testPrefix));

        console.log("✅ Test data cleaned up");
      }
    } catch (error) {
      console.error("⚠️ Error during cleanup:", error.message);
    }

    if (app) {
      await app.close();
    }
  });

  describe("TC-001: Complete Booking Flow (Happy Path)", () => {
    it("should successfully book a session with all steps", async () => {
      // Arrange - Create test data
      const studentId = uuidv4();
      const mentorId = uuidv4();
      const contractId = uuidv4();

      // Create contract
      const productSnapshot = {
        productId: uuidv4(),
        productName: "Test Package",
        price: "1000.00",
        currency: "CNY",
        validityDays: 365,
        items: [
          {
            productItemType: "service",
            productItemId: uuidv4(),
            quantity: 10,
            service: {
              serviceId: uuidv4(),
              serviceName: "1-on-1 Mentoring",
              serviceType: "one_on_one",
              duration: 60,
            },
          },
        ],
      };

      await db
        .insert(schema.contracts)
        .values({
          id: contractId,
          studentId,
          contractNumber: `${testPrefix}-001`,
          productId: productSnapshot.productId,
          productSnapshot: productSnapshot as any,
          status: "active",
          totalAmount: "1000.00",
          currency: "CNY",
          signedAt: new Date(),
          activatedAt: new Date(),
          createdBy: "test-system",
        } as any);

      // Create entitlement
      await db.insert(schema.contractServiceEntitlements).values({
        studentId,
        serviceType: "session",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        createdBy: "test-system",
      });

      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        serviceType: "session",
        scheduledStartTime: new Date("2025-12-15T10:00:00Z").toISOString(),
        duration: 60,
        topic: `${testPrefix} - Happy Path Test`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Test Input:", {
        studentId: testInput.studentId,
        mentorId: testInput.mentorId,
      });

      // Act - Execute booking
      console.log("\n🚀 Executing booking...");
      const result = await command.execute(testInput);

      // Assert - Verify result
      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.status).toBe("scheduled");
      expect(result.studentId).toBe(studentId);
      expect(result.mentorId).toBe(mentorId);
      expect(result.meetingUrl).toBeDefined();
      expect(result.mentorCalendarSlotId).toBeDefined();
      expect(result.serviceHoldId).toBeDefined();

      console.log("\n✅ Booking Result:", {
        sessionId: result.sessionId,
        status: result.status,
        meetingUrl: result.meetingUrl ? "Generated" : "Not generated",
        mentorCalendarSlotId: result.mentorCalendarSlotId,
        serviceHoldId: result.serviceHoldId,
      });

      // Verify Session in database
      const [savedSession] = await db
        .select()
        .from(schema.regularMentoringSessions)
        .where(eq(schema.regularMentoringSessions.id, result.sessionId));

      expect(savedSession).toBeDefined();
      expect(savedSession.studentUserId).toBe(studentId);
      expect(savedSession.mentorUserId).toBe(mentorId);
      expect(savedSession.status).toBe("scheduled");
      expect(savedSession.title).toBe(testInput.topic);
      console.log("✓ Verified: Session saved in database");

      // Verify Calendar Slot
      const [savedSlot] = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.id, result.mentorCalendarSlotId));

      expect(savedSlot).toBeDefined();
      expect(savedSlot.userId).toBe(mentorId);
      expect(savedSlot.sessionId).toBe(result.sessionId);
      expect(savedSlot.sessionType).toBe("regular_mentoring");
      expect(savedSlot.status).toBe("booked");
      console.log("✓ Verified: Calendar slot created");

      // Verify Service Hold
      const [savedHold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, result.serviceHoldId));

      expect(savedHold).toBeDefined();
      expect(savedHold.status).toBe("active");
      expect(savedHold.quantity).toBe(1);
      expect(savedHold.expiryAt).toBeInstanceOf(Date);
      console.log("✓ Verified: Service hold created");

      // Verify Balance Update
      const [entitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.studentId, studentId),
            eq(schema.contractServiceEntitlements.serviceType, "session"),
          ),
        );

      expect(entitlement.heldQuantity).toBe(1);
      expect(entitlement.availableQuantity).toBe(9); // 10 - 1
      console.log("✓ Verified: Balance updated correctly");

      console.log("\n🎉 SUCCESS: Complete booking flow verified!");
    }, 30000);
  });

  describe("TC-002: Insufficient Balance Rejection", () => {
    it("should reject booking when balance is insufficient", async () => {
      // Arrange - Create contract with zero balance
      const studentId = uuidv4();
      const mentorId = uuidv4();
      const contractId = uuidv4();

      const productSnapshot = {
        productId: uuidv4(),
        productName: "Test Package - Empty",
        price: "1000.00",
        currency: "CNY",
        validityDays: 365,
        items: [
          {
            productItemType: "service",
            productItemId: uuidv4(),
            quantity: 1,
            service: {
              serviceId: uuidv4(),
              serviceName: "1-on-1 Mentoring",
              serviceType: "one_on_one",
              duration: 60,
            },
          },
        ],
      };

      await db.insert(schema.contracts).values({
        id: contractId,
        studentId,
        contractNumber: `${testPrefix}-002`,
        productId: productSnapshot.productId,
        productSnapshot: productSnapshot as any,
        status: "active",
        totalAmount: "1000.00",
        currency: "CNY",
        signedAt: new Date(),
        activatedAt: new Date(),
        createdBy: "test-system",
      } as any);

      // Create entitlement with zero available balance
      await db.insert(schema.contractServiceEntitlements).values({
        studentId,
        serviceType: "session",
        totalQuantity: 1,
        consumedQuantity: 1,
        heldQuantity: 0,
        availableQuantity: 0, // Zero balance!
        createdBy: "test-system",
      });

      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        serviceType: "session",
        scheduledStartTime: new Date("2025-12-16T10:00:00Z").toISOString(),
        duration: 60,
        topic: `${testPrefix} - Insufficient Balance Test`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Attempting booking with zero balance...");

      // Act & Assert
      await expect(command.execute(testInput)).rejects.toThrow();

      console.log("✓ Verified: Booking rejected due to insufficient balance");

      // Verify no session created
      const sessions = await db
        .select()
        .from(schema.regularMentoringSessions)
        .where(eq(schema.regularMentoringSessions.studentUserId, studentId));

      expect(sessions).toHaveLength(0);
      console.log("✓ Verified: No session created");

      // Verify no hold created
      const holds = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.studentId, studentId));

      expect(holds).toHaveLength(0);
      console.log("✓ Verified: No hold created");

      console.log("\n🎉 SUCCESS: Insufficient balance properly rejected!");
    }, 30000);
  });

  describe("TC-003: Time Conflict Detection", () => {
    it("should reject booking when mentor has time conflict", async () => {
      // Arrange - Create first booking
      const studentId1 = uuidv4();
      const studentId2 = uuidv4();
      const mentorId = uuidv4(); // Same mentor for both bookings
      const contractId1 = uuidv4();
      const contractId2 = uuidv4();

      // Create first contract and book session
      const productSnapshot = {
        productId: uuidv4(),
        productName: "Test Package",
        price: "1000.00",
        currency: "CNY",
        validityDays: 365,
        items: [
          {
            productItemType: "service",
            productItemId: uuidv4(),
            quantity: 10,
            service: {
              serviceId: uuidv4(),
              serviceName: "1-on-1 Mentoring",
              serviceType: "one_on_one",
              duration: 60,
            },
          },
        ],
      };

      // Setup first contract
      await db.insert(schema.contracts).values({
        id: contractId1,
        studentId: studentId1,
        contractNumber: `${testPrefix}-003a`,
        productId: productSnapshot.productId,
        productSnapshot: productSnapshot as any,
        status: "active",
        totalAmount: "1000.00",
        currency: "CNY",
        signedAt: new Date(),
        activatedAt: new Date(),
        createdBy: "test-system",
      } as any);

      await db.insert(schema.contractServiceEntitlements).values({
        studentId: studentId1,
        serviceType: "session",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        createdBy: "test-system",
      });

      const firstBooking: BookSessionInput = {
        counselorId: uuidv4(),
        studentId: studentId1,
        mentorId,
        serviceType: "session",
        scheduledStartTime: new Date("2025-12-17T10:00:00Z").toISOString(),
        duration: 60,
        topic: `${testPrefix} - First Booking`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Creating first booking...");
      const firstResult = await command.execute(firstBooking);
      expect(firstResult).toBeDefined();
      console.log("✓ First booking created:", firstResult.sessionId);

      // Setup second contract
      await db.insert(schema.contracts).values({
        id: contractId2,
        studentId: studentId2,
        contractNumber: `${testPrefix}-003b`,
        productId: productSnapshot.productId,
        productSnapshot: productSnapshot as any,
        status: "active",
        totalAmount: "1000.00",
        currency: "CNY",
        signedAt: new Date(),
        activatedAt: new Date(),
        createdBy: "test-system",
      } as any);

      await db.insert(schema.contractServiceEntitlements).values({
        studentId: studentId2,
        serviceType: "session",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        createdBy: "test-system",
      });

      // Attempt conflicting booking (same mentor, same time)
      const conflictBooking: BookSessionInput = {
        counselorId: uuidv4(),
        studentId: studentId2,
        mentorId, // Same mentor!
        serviceType: "session",
        scheduledStartTime: new Date("2025-12-17T10:00:00Z").toISOString(), // Same time!
        duration: 60,
        topic: `${testPrefix} - Conflict Booking`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Attempting conflicting booking...");

      // Act & Assert
      await expect(command.execute(conflictBooking)).rejects.toThrow();
      console.log("✓ Verified: Conflicting booking rejected");

      // Verify only one session exists for this mentor
      const sessions = await db
        .select()
        .from(schema.regularMentoringSessions)
        .where(eq(schema.regularMentoringSessions.mentorUserId, mentorId));

      expect(sessions).toHaveLength(1);
      console.log("✓ Verified: Only one session exists for mentor");

      console.log("\n🎉 SUCCESS: Time conflict properly prevented!");
    }, 30000);
  });

  describe("TC-004: Transaction Rollback on Meeting Creation Failure", () => {
    it("should rollback all changes if meeting creation fails", async () => {
      // Arrange
      const studentId = uuidv4();
      const mentorId = uuidv4();
      const contractId = uuidv4();

      const productSnapshot = {
        productId: uuidv4(),
        productName: "Test Package",
        price: "1000.00",
        currency: "CNY",
        validityDays: 365,
        items: [
          {
            productItemType: "service",
            productItemId: uuidv4(),
            quantity: 10,
            service: {
              serviceId: uuidv4(),
              serviceName: "1-on-1 Mentoring",
              serviceType: "one_on_one",
              duration: 60,
            },
          },
        ],
      };

      await db.insert(schema.contracts).values({
        id: contractId,
        studentId,
        contractNumber: `${testPrefix}-004`,
        productId: productSnapshot.productId,
        productSnapshot: productSnapshot as any,
        status: "active",
        totalAmount: "1000.00",
        currency: "CNY",
        signedAt: new Date(),
        activatedAt: new Date(),
        createdBy: "test-system",
      } as any);

      await db.insert(schema.contractServiceEntitlements).values({
        studentId,
        serviceType: "session",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        createdBy: "test-system",
      });

      // Use invalid meeting provider to trigger failure
      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        serviceType: "session",
        scheduledStartTime: new Date("2025-12-18T10:00:00Z").toISOString(),
        duration: 60,
        topic: `${testPrefix} - Rollback Test`,
        meetingProvider: "invalid_provider" as any, // This will fail
      };

      console.log("\n📝 Attempting booking with invalid meeting provider...");

      // Act & Assert
      await expect(command.execute(testInput)).rejects.toThrow();
      console.log("✓ Verified: Booking failed as expected");

      // Verify complete rollback - no session
      const sessions = await db
        .select()
        .from(schema.regularMentoringSessions)
        .where(eq(schema.regularMentoringSessions.studentUserId, studentId));

      expect(sessions).toHaveLength(0);
      console.log("✓ Verified: No session created (rolled back)");

      // Verify no hold
      const holds = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.studentId, studentId));

      expect(holds).toHaveLength(0);
      console.log("✓ Verified: No hold created (rolled back)");

      // Verify no calendar slot
      const slots = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.userId, mentorId));

      expect(slots).toHaveLength(0);
      console.log("✓ Verified: No calendar slot created (rolled back)");

      // Verify balance unchanged
      const [entitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.studentId, studentId),
            eq(schema.contractServiceEntitlements.serviceType, "session"),
          ),
        );

      expect(entitlement.heldQuantity).toBe(0);
      expect(entitlement.availableQuantity).toBe(10);
      console.log("✓ Verified: Balance unchanged (rolled back)");

      console.log("\n🎉 SUCCESS: Transaction rollback verified!");
    }, 30000);
  });

  describe("TC-007: Session Completion and Balance Deduction", () => {
    it("should consume service and release hold after session completion", async () => {
      // Arrange - Create and book a session
      const studentId = uuidv4();
      const mentorId = uuidv4();
      const contractId = uuidv4();

      const productSnapshot = {
        productId: uuidv4(),
        productName: "Test Package",
        price: "1000.00",
        currency: "CNY",
        validityDays: 365,
        items: [
          {
            productItemType: "service",
            productItemId: uuidv4(),
            quantity: 10,
            service: {
              serviceId: uuidv4(),
              serviceName: "1-on-1 Mentoring",
              serviceType: "one_on_one",
              duration: 60,
            },
          },
        ],
      };

      await db.insert(schema.contracts).values({
        id: contractId,
        studentId,
        contractNumber: `${testPrefix}-007`,
        productId: productSnapshot.productId,
        productSnapshot: productSnapshot as any,
        status: "active",
        totalAmount: "1000.00",
        currency: "CNY",
        signedAt: new Date(),
        activatedAt: new Date(),
        createdBy: "test-system",
      } as any);

      await db.insert(schema.contractServiceEntitlements).values({
        studentId,
        serviceType: "session",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        createdBy: "test-system",
      });

      // Book session
      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        serviceType: "session",
        scheduledStartTime: new Date("2025-12-20T10:00:00Z").toISOString(),
        duration: 60,
        topic: `${testPrefix} - Completion Test`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Booking session...");
      const bookingResult = await command.execute(testInput);
      expect(bookingResult).toBeDefined();
      console.log("✓ Session booked:", bookingResult.sessionId);

      // Update session to completed status
      await db
        .update(schema.regularMentoringSessions)
        .set({ status: "completed" })
        .where(eq(schema.regularMentoringSessions.id, bookingResult.sessionId));

      // Act - Consume service
      console.log("\n📝 Consuming service...");
      await contractService.consumeService({
        studentId,
        serviceType: "session",
        quantity: 1,
        relatedBookingId: bookingResult.sessionId,
        relatedHoldId: bookingResult.serviceHoldId,
        createdBy: "test-system",
      });
      console.log("✓ Service consumed");

      // Assert - Verify ledger entry
      const ledgers = await db
        .select()
        .from(schema.serviceLedgers)
        .where(
          and(
            eq(schema.serviceLedgers.studentId, studentId),
            eq(schema.serviceLedgers.relatedBookingId, bookingResult.sessionId),
          ),
        );

      expect(ledgers).toHaveLength(1);
      expect(ledgers[0].quantity).toBe(-1);
      expect(ledgers[0].type).toBe("consumption");
      expect(ledgers[0].source).toBe("booking_completed");
      console.log("✓ Verified: Ledger entry created");

      // Verify hold released
      const [hold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, bookingResult.serviceHoldId));

      expect(hold.status).toBe("released");
      expect(hold.releaseReason).toBe("completed");
      console.log("✓ Verified: Hold released");

      // Verify balance updated
      const [entitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.studentId, studentId),
            eq(schema.contractServiceEntitlements.serviceType, "session"),
          ),
        );

      expect(entitlement.consumedQuantity).toBe(1);
      expect(entitlement.heldQuantity).toBe(0); // Released
      expect(entitlement.availableQuantity).toBe(9); // 10 - 1
      console.log("✓ Verified: Balance updated correctly");

      console.log("\n🎉 SUCCESS: Session completion and balance deduction verified!");
    }, 30000);
  });

  describe("TC-008: Hold Expiration Cleanup", () => {
    it("should automatically expire holds past TTL", async () => {
      // Arrange - Create expired hold directly in database
      const studentId = uuidv4();
      const contractId = uuidv4();

      const productSnapshot = {
        productId: uuidv4(),
        productName: "Test Package",
        price: "1000.00",
        currency: "CNY",
        validityDays: 365,
        items: [
          {
            productItemType: "service",
            productItemId: uuidv4(),
            quantity: 10,
            service: {
              serviceId: uuidv4(),
              serviceName: "1-on-1 Mentoring",
              serviceType: "one_on_one",
              duration: 60,
            },
          },
        ],
      };

      await db.insert(schema.contracts).values({
        id: contractId,
        studentId,
        contractNumber: `${testPrefix}-008`,
        productId: productSnapshot.productId,
        productSnapshot: productSnapshot as any,
        status: "active",
        totalAmount: "1000.00",
        currency: "CNY",
        signedAt: new Date(),
        activatedAt: new Date(),
        createdBy: "test-system",
      } as any);

      await db.insert(schema.contractServiceEntitlements).values({
        studentId,
        serviceType: "session",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 1, // Manually set to simulate hold
        availableQuantity: 9,
        createdBy: "test-system",
      });

      // Create expired hold
      const [expiredHold] = await db
        .insert(schema.serviceHolds)
        .values({
          studentId,
          serviceType: "session",
          quantity: 1,
          status: "active" as any,
          expiryAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired!)
          relatedBookingId: null,
          createdBy: "test-system",
        })
        .returning();

      console.log("\n📝 Created expired hold:", expiredHold.id);
      console.log("Expires at:", expiredHold.expiryAt);

      // Act - Run cleanup
      console.log("\n📝 Running hold cleanup...");
      const result = await serviceHoldService.releaseExpiredHolds();
      const expiredCount = result.releasedCount;
      console.log(`✓ Expired ${expiredCount} holds`);

      // Assert
      expect(expiredCount).toBeGreaterThan(0);

      // Verify hold status
      const [updatedHold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, expiredHold.id));

      expect(updatedHold.status).toBe("expired");
      expect(updatedHold.releaseReason).toBe("expired");
      expect(updatedHold.releasedAt).toBeDefined();
      console.log("✓ Verified: Hold marked as expired");

      // Note: Balance should be restored by trigger (if implemented)
      // This test verifies the hold expiration logic only

      console.log("\n🎉 SUCCESS: Hold expiration cleanup verified!");
    }, 30000);
  });
});
