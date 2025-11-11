import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { ServiceHoldService } from "../../src/domains/contract/services/service-hold.service";
import { SessionCreatedListener } from "../../src/domains/contract/events/listeners/session-created.listener";
import {
  SessionCreatedEvent,
  SESSION_CREATED_EVENT,
} from "../../src/shared/events/session-created.event";
import { DATABASE_CONNECTION } from "../../src/infrastructure/database/database.provider";
import { DatabaseModule } from "../../src/infrastructure/database/database.module";
import { ConfigModule } from "@nestjs/config";
import * as schema from "../../src/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * E2E 集成测试：验证 Hold 与 Session 的关联流程
 *
 * 测试场景：完整的预约流程
 * 1. 创建 hold（relatedBookingId = null）
 * 2. 发布 session.created 事件
 * 3. 验证监听器正确更新 hold.relatedBookingId
 *
 * 关键验证点：
 * - session.created 事件被正确发布
 * - SessionCreatedListener 成功接收并处理事件
 * - ServiceHoldService.updateRelatedBooking 被正确调用
 * - 数据库中的 hold.relatedBookingId 被更新为 session.id
 */
describe("Hold-Session Association Flow - E2E Test", () => {
  let app: TestingModule;
  let db: NodePgDatabase;
  let eventEmitter: EventEmitter2;
  let serviceHoldService: ServiceHoldService;
  let listener: SessionCreatedListener;

  const testData = {
    holdId: "d1e1a1b1-c1d1-4e1f-a1b1-c1d1e1f1a1b1",
    sessionId: "f2e2b2c2-d2e2-4f2b-b2c2-d2e2f2b2c2d2",
    contractId: "a3f3c3d3-e3f3-4a3c-c3d3-e3f3a3c3d3e3",
    studentId: "test_student_1111111111111111", // varchar(28)
    mentorId: "test_mentor_111111111111111111", // varchar(30)
    counselorId: "test_counselor_111111111111", // varchar(28)
    serviceType: "resume_review",
    contractType: "mock_interview",
  };

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env",
          isGlobal: true,
        }),
        DatabaseModule,
        EventEmitterModule.forRoot(),
      ],
      providers: [
        ServiceHoldService,
        SessionCreatedListener,
        {
          provide: DATABASE_CONNECTION,
          useValue: undefined, // Will be overridden by database module
        },
      ],
    }).compile();

    db = app.get<NodePgDatabase>(DATABASE_CONNECTION);
    eventEmitter = app.get<EventEmitter2>(EventEmitter2);
    serviceHoldService = app.get<ServiceHoldService>(ServiceHoldService);
    listener = app.get<SessionCreatedListener>(SessionCreatedListener);

    console.log("✅ Test Module initialized");
  });

  afterAll(async () => {
    // Clean up test data
    try {
      if (db) {
        await db
          .delete(schema.serviceHolds)
          .where(eq(schema.serviceHolds.id, testData.holdId));
        console.log("✅ Test data cleaned up");
      }
    } catch (error) {
      console.error("⚠️  Cleanup error:", error.message);
    }

    if (app) {
      await app.close();
    }
  });

  describe("➡️ 完整的 Hold-Session 关联流程", () => {
    it("应该通过事件机制建立 hold 与 session 的关联", async () => {
      // Step 1: 在数据库中创建测试用的 hold（relatedBookingId = null）
      console.log("Step 1: Creating hold with relatedBookingId = null...");
      const now = new Date();
      await db.insert(schema.serviceHolds).values({
        id: testData.holdId,
        contractId: testData.contractId,
        studentId: testData.studentId,
        serviceType: "mock_interview",
        quantity: 1,
        status: "active",
        relatedBookingId: null, // Initially null
        createdBy: testData.counselorId,
        createdAt: now,
        updatedAt: now,
      });

      // Verify hold created with null relatedBookingId
      const [createdHold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, testData.holdId));

      expect(createdHold).toBeDefined();
      expect(createdHold.relatedBookingId).toBeNull();
      console.log("✅ Hold created with relatedBookingId = null");

      // Step 2: 发布 session.created 事件
      console.log("Step 2: Publishing session.created event...");
      const event: SessionCreatedEvent = {
        sessionId: testData.sessionId,
        holdId: testData.holdId,
        contractId: testData.contractId,
        studentId: testData.studentId,
        mentorId: testData.mentorId,
        serviceType: "mock_interview",
      };

      // Use async-await to wait for event processing
      await eventEmitter.emitAsync(SESSION_CREATED_EVENT, event);
      console.log("✅ Event published and processed");

      // Step 3: 验证 hold.relatedBookingId 被更新
      console.log("Step 3: Verifying hold.relatedBookingId updated...");
      const [updatedHold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, testData.holdId));

      expect(updatedHold).toBeDefined();
      expect(updatedHold.relatedBookingId).toBe(testData.sessionId);
      expect(updatedHold.relatedBookingId).not.toBeNull();
      console.log(
        "✅ Hold.relatedBookingId updated to:",
        updatedHold.relatedBookingId,
      );
    }, 30000); // 30 second timeout for database operations

    it("应该处理事件处理失败的情况（hold 不存在）", async () => {
      const nonExistentHoldId = "e3f3c3d3-d3e3-4f3c-c3d3-e3f3d3e3f3e3"; // valid UUID
      const event: SessionCreatedEvent = {
        sessionId: "g4f4d4e4-h4i4-4j4k-l4m4-n4o4p4q4r4s4", // valid UUID
        holdId: nonExistentHoldId,
        contractId: "b5g5e5f5-i5j5-4k5l-m5n5-o5p5q5r5s5t5", // valid UUID
        studentId: "test_student_22222222222222222", // varchar(25)
        mentorId: "test_mentor_222222222222", // varchar(24)
        serviceType: "mock_interview",
      };

      // This should not throw, but log an error
      await expect(
        eventEmitter.emitAsync(SESSION_CREATED_EVENT, event),
      ).resolves.not.toThrow();

      console.log(
        "✅ Event processed without throwing exception (error logged)",
      );
    }, 10000);
  });

  describe("📊 事件监听器功能验证", () => {
    it("SessionCreatedListener 应该正确注册并监听事件", () => {
      expect(listener).toBeDefined();
      expect(typeof listener.handleSessionCreated).toBe("function");
      console.log("✅ SessionCreatedListener properly initialized");
    });

    it("ServiceHoldService.updateRelatedBooking 应该正确更新数据库", async () => {
      const testHoldId = "c6d6e6f6-a6b6-4c6d-d6e6-f6a6b6c6d6e6"; // valid UUID
      const testSessionId = "d7e7f7a7-b7c7-4d7e-e7f7-a7b7c7d7e7f7"; // valid UUID
      const testContractId = "e8f8a8b8-c8d8-4e8f-f8a8-b8c8d8e8f8a8"; // valid UUID

      // Create a hold
      const now = new Date();
      await db.insert(schema.serviceHolds).values({
        id: testHoldId,
        contractId: testContractId,
        studentId: "test_student_9999999999999999", // varchar(22)
        serviceType: "mock_interview",
        quantity: 1,
        status: "active",
        relatedBookingId: null,
        createdBy: "test_counselor_111111111111", // varchar(28)
        expiryHours: 24,
        expiryAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Update via service method
      await serviceHoldService.updateRelatedBooking(testHoldId, testSessionId);

      // Verify update
      const [hold] = await db
        .select()
        .from(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, testHoldId));

      expect(hold.relatedBookingId).toBe(testSessionId);
      console.log("✅ ServiceHoldService.updateRelatedBooking works correctly");

      // Clean up
      await db
        .delete(schema.serviceHolds)
        .where(eq(schema.serviceHolds.id, testHoldId));
    }, 15000);
  });
});
