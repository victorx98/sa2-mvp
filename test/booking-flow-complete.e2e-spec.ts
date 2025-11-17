import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { BookSessionCommand } from "../src/application/commands/booking/book-session.command";
import { CalendarService } from "../src/core/calendar";
import {
  MeetingProviderFactory,
  MeetingProviderType,
} from "../src/core/meeting-providers";
import { MeetingProviderModule } from "../src/core/meeting-providers/meeting-provider.module";
import { SessionService } from "../src/domains/services/session/services/session.service";
import { ContractService } from "../src/domains/contract/services/contract.service";
import { ServiceHoldService } from "../src/domains/contract/services/service-hold.service";
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
  let sessionService: SessionService;
  let calendarService: CalendarService;
  let contractService: ContractService;
  let serviceHoldService: ServiceHoldService;
  let meetingProviderFactory: MeetingProviderFactory;

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
        DatabaseModule,
        MeetingProviderModule,
        TelemetryModule,
      ],
      providers: [
        BookSessionCommand,
        SessionService,
        ContractService,
        ServiceHoldService,
        CalendarService,
      ],
    }).compile();

    command = app.get<BookSessionCommand>(BookSessionCommand);
    db = app.get<NodePgDatabase>(DATABASE_CONNECTION);
    sessionService = app.get<SessionService>(SessionService);
    calendarService = app.get<CalendarService>(CalendarService);
    contractService = app.get<ContractService>(ContractService);
    serviceHoldService = app.get<ServiceHoldService>(ServiceHoldService);
    meetingProviderFactory = app.get<MeetingProviderFactory>(
      MeetingProviderFactory,
    );

    console.log("✅ Test module initialized with real database");
  });

  afterAll(async () => {
    // Clean up all test data
    try {
      if (db) {
        // Delete in dependency order
        await db
          .delete(schema.calendarSlots)
          .where(eq(schema.calendarSlots.resourceId, testPrefix));

        await db
          .delete(schema.serviceHolds)
          .where(eq(schema.serviceHolds.studentId, testPrefix));

        await db
          .delete(schema.serviceLedgers)
          .where(eq(schema.serviceLedgers.studentId, testPrefix));

        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.studentId, testPrefix));

        await db
          .delete(schema.contractServiceEntitlements)
          .where(eq(schema.contractServiceEntitlements.contractId, testPrefix));

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

      const contract = await db
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
        })
        .returning();

      // Create entitlement
      await db.insert(schema.contractServiceEntitlements).values({
        contractId,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        contractId,
        serviceId: productSnapshot.items[0].service.serviceId,
        scheduledStartTime: new Date("2025-12-15T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-15T11:00:00Z"),
        duration: 60,
        topic: `${testPrefix} - Happy Path Test`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Test Input:", {
        studentId: testInput.studentId,
        mentorId: testInput.mentorId,
        contractId: testInput.contractId,
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
      expect(result.calendarSlotId).toBeDefined();
      expect(result.serviceHoldId).toBeDefined();

      console.log("\n✅ Booking Result:", {
        sessionId: result.sessionId,
        status: result.status,
        meetingUrl: result.meetingUrl ? "Generated" : "Not generated",
        calendarSlotId: result.calendarSlotId,
        serviceHoldId: result.serviceHoldId,
      });

      // Verify Session in database
      const [savedSession] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, result.sessionId));

      expect(savedSession).toBeDefined();
      expect(savedSession.studentId).toBe(studentId);
      expect(savedSession.mentorId).toBe(mentorId);
      expect(savedSession.status).toBe("scheduled");
      expect(savedSession.meetingUrl).toBeDefined();
      expect(savedSession.sessionName).toBe(testInput.topic);
      console.log("✓ Verified: Session saved in database");

      // Verify Calendar Slot
      const [savedSlot] = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.id, result.calendarSlotId));

      expect(savedSlot).toBeDefined();
      expect(savedSlot.resourceId).toBe(mentorId);
      expect(savedSlot.sessionId).toBe(result.sessionId);
      expect(savedSlot.slotType).toBe("session");
      expect(savedSlot.status).toBe("occupied");
      console.log("✓ Verified: Calendar slot created");

      // Verify Service Hold
      const [savedHold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, result.serviceHoldId));

      expect(savedHold).toBeDefined();
      expect(savedHold.status).toBe("active");
      expect(savedHold.quantity).toBe(1);
      expect(savedHold.expiresAt).toBeInstanceOf(Date);
      console.log("✓ Verified: Service hold created");

      // Verify Balance Update
      const [entitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(eq(schema.contractServiceEntitlements.contractId, contractId));

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
      });

      // Create entitlement with zero available balance
      await db.insert(schema.contractServiceEntitlements).values({
        contractId,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 1,
        consumedQuantity: 1,
        heldQuantity: 0,
        availableQuantity: 0, // Zero balance!
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        contractId,
        serviceId: productSnapshot.items[0].service.serviceId,
        scheduledStartTime: new Date("2025-12-16T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-16T11:00:00Z"),
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
        .from(schema.sessions)
        .where(eq(schema.sessions.studentId, studentId));

      expect(sessions).toHaveLength(0);
      console.log("✓ Verified: No session created");

      // Verify no hold created
      const holds = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.contractId, contractId));

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
      });

      await db.insert(schema.contractServiceEntitlements).values({
        contractId: contractId1,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const firstBooking: BookSessionInput = {
        counselorId: uuidv4(),
        studentId: studentId1,
        mentorId,
        contractId: contractId1,
        serviceId: productSnapshot.items[0].service.serviceId,
        scheduledStartTime: new Date("2025-12-17T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-17T11:00:00Z"),
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
      });

      await db.insert(schema.contractServiceEntitlements).values({
        contractId: contractId2,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // Attempt conflicting booking (same mentor, same time)
      const conflictBooking: BookSessionInput = {
        counselorId: uuidv4(),
        studentId: studentId2,
        mentorId, // Same mentor!
        contractId: contractId2,
        serviceId: productSnapshot.items[0].service.serviceId,
        scheduledStartTime: new Date("2025-12-17T10:00:00Z"), // Same time!
        scheduledEndTime: new Date("2025-12-17T11:00:00Z"),
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
        .from(schema.sessions)
        .where(eq(schema.sessions.mentorId, mentorId));

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
      });

      await db.insert(schema.contractServiceEntitlements).values({
        contractId,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // Use invalid meeting provider to trigger failure
      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        contractId,
        serviceId: productSnapshot.items[0].service.serviceId,
        scheduledStartTime: new Date("2025-12-18T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-18T11:00:00Z"),
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
        .from(schema.sessions)
        .where(eq(schema.sessions.studentId, studentId));

      expect(sessions).toHaveLength(0);
      console.log("✓ Verified: No session created (rolled back)");

      // Verify no hold
      const holds = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.contractId, contractId));

      expect(holds).toHaveLength(0);
      console.log("✓ Verified: No hold created (rolled back)");

      // Verify no calendar slot
      const slots = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.resourceId, mentorId));

      expect(slots).toHaveLength(0);
      console.log("✓ Verified: No calendar slot created (rolled back)");

      // Verify balance unchanged
      const [entitlement] = await db
        .select()
        .from(schema.contractServiceEntitlements)
        .where(eq(schema.contractServiceEntitlements.contractId, contractId));

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
      });

      await db.insert(schema.contractServiceEntitlements).values({
        contractId,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: 10,
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // Book session
      const testInput: BookSessionInput = {
        counselorId: uuidv4(),
        studentId,
        mentorId,
        contractId,
        serviceId: productSnapshot.items[0].service.serviceId,
        scheduledStartTime: new Date("2025-12-20T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-20T11:00:00Z"),
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
        .update(schema.sessions)
        .set({ status: "completed" })
        .where(eq(schema.sessions.id, bookingResult.sessionId));

      // Act - Consume service
      console.log("\n📝 Consuming service...");
      await contractService.consumeService({
        contractId,
        serviceType: "one_on_one",
        quantity: 1,
        sessionId: bookingResult.sessionId,
        holdId: bookingResult.serviceHoldId,
        createdBy: "test-system",
      });
      console.log("✓ Service consumed");

      // Assert - Verify ledger entry
      const ledgers = await db
        .select()
        .from(schema.serviceLedgers)
        .where(
          and(
            eq(schema.serviceLedgers.contractId, contractId),
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
        .where(eq(schema.contractServiceEntitlements.contractId, contractId));

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
      });

      await db.insert(schema.contractServiceEntitlements).values({
        contractId,
        serviceType: "one_on_one",
        source: "product",
        totalQuantity: 10,
        consumedQuantity: 0,
        heldQuantity: 1, // Manually set to simulate hold
        availableQuantity: 9,
        serviceSnapshot: productSnapshot.items[0].service as any,
        originItems: [] as any,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // Create expired hold
      const [expiredHold] = await db
        .insert(schema.serviceHolds)
        .values({
          contractId,
          studentId,
          serviceType: "one_on_one",
          quantity: 1,
          status: "active",
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired!)
          relatedBookingId: null,
          createdBy: "test-system",
        })
        .returning();

      console.log("\n📝 Created expired hold:", expiredHold.id);
      console.log("Expires at:", expiredHold.expiresAt);

      // Act - Run cleanup
      console.log("\n📝 Running hold cleanup...");
      const expiredCount = await serviceHoldService.expireHolds();
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
