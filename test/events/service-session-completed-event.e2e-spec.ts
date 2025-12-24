import { Test } from "@nestjs/testing";
import { ServiceSessionCompletedEvent } from "@application/events";
import { SessionCompletedListener } from "@application/events/handlers/contract/session-completed-listener";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  TestDatabaseHelper,
  createTestDatabaseHelper,
} from "../../test/utils/test-database.helper";
import * as schema from "@infrastructure/database/schema";
import { DrizzleDatabase } from "@shared/types/database.types";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { HoldStatus } from "@shared/types/contract-enums";

describe("Service Session Completed Event Integration Test [服务会话完成事件集成测试]", () => {
  let sessionCompletedListener: SessionCompletedListener;
  let serviceHoldService: ServiceHoldService;
  let serviceLedgerService: ServiceLedgerService;
  let db: DrizzleDatabase;
  let testDatabaseHelper: TestDatabaseHelper;

  // Test data (dynamically created in beforeAll)
  let testStudentId: string;
  let testServiceType: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize test database connection
    testDatabaseHelper = await createTestDatabaseHelper();
    db = testDatabaseHelper.getDatabase();

    // Create test data
    console.log("📋 Creating test data...");
    
    // Create test user
    testUserId = randomUUID();
    await db.insert(schema.userTable).values({
      id: testUserId,
      email: `test-${randomUUID()}@example.com`,
      nameEn: "Test User",
      nameZh: "测试用户",
      status: "active",
    });
    
    // Create service type
    testServiceType = `test-service-${randomUUID().slice(0, 8)}`;
    await db.insert(schema.serviceTypes).values({
      code: testServiceType,
      name: "Test Service",
      description: "Test service for integration testing",
      status: "ACTIVE",
    });
    
    // Create student user
    testStudentId = randomUUID();
    await db.insert(schema.userTable).values({
      id: testStudentId,
      email: `student-${randomUUID()}@example.com`,
      nameEn: "Test Student",
      nameZh: "测试学生",
      status: "active",
    });
    
    // Create contract service entitlement
    await db.insert(schema.contractServiceEntitlements).values({
      studentId: testStudentId,
      serviceType: testServiceType,
      totalQuantity: 10,
      consumedQuantity: 0,
      heldQuantity: 0,
      availableQuantity: 10,
      createdBy: testUserId,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionCompletedListener,
        ServiceHoldService,
        ServiceLedgerService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    sessionCompletedListener = moduleRef.get<SessionCompletedListener>(
      SessionCompletedListener,
    );
    serviceHoldService = moduleRef.get<ServiceHoldService>(ServiceHoldService);
    serviceLedgerService = moduleRef.get<ServiceLedgerService>(ServiceLedgerService);

    console.log("✅ Test setup complete [测试设置完成]");
    console.log("📋 Created test data:", {
      studentId: testStudentId,
      serviceType: testServiceType,
      userId: testUserId,
    });
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    console.log("🧹 Cleaning up test data...");
    
    // Delete in reverse order of creation to respect foreign key constraints
    await db.delete(schema.contractServiceEntitlements)
      .where(and(
        eq(schema.contractServiceEntitlements.studentId, testStudentId),
        eq(schema.contractServiceEntitlements.serviceType, testServiceType)
      ));
    
    await db.delete(schema.serviceTypes)
      .where(eq(schema.serviceTypes.code, testServiceType));
    
    await db.delete(schema.userTable)
      .where(eq(schema.userTable.id, testStudentId));
    
    await db.delete(schema.userTable)
      .where(eq(schema.userTable.id, testUserId));
    
    console.log("✅ Test data cleaned up");
    
    // Close database connection
    if (testDatabaseHelper) {
      await testDatabaseHelper.close();
    }
  }, 30000);

  it("should release hold and record consumption when session completes [当会话完成时应该释放预占并记录消耗]", async () => {
    // Arrange [准备]
    const sessionId = randomUUID();
    const createdBy = testUserId; // Must be a valid UUID from user table
    const quantity = 1;

    console.log(
      "\n📌 Step 1: Query initial entitlement state [查询初始权益状态]",
    );

    // Query initial entitlement state [查询初始权益状态]
    const [initialEntitlement] = await db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(
            schema.contractServiceEntitlements.studentId,
            testStudentId,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            testServiceType,
          ),
        ),
      )
      .limit(1);

    if (!initialEntitlement) {
      throw new Error(
        "Initial entitlement not found. Ensure test data was created correctly.",
      );
    }

    const initialHeldQuantity = initialEntitlement.heldQuantity;
    const initialConsumedQuantity = initialEntitlement.consumedQuantity;

    console.log("✅ Initial entitlement state:", {
      studentId: initialEntitlement.studentId,
      serviceType: initialEntitlement.serviceType,
      totalQuantity: initialEntitlement.totalQuantity,
      heldQuantity: initialHeldQuantity,
      consumedQuantity: initialConsumedQuantity,
      availableQuantity: initialEntitlement.availableQuantity,
    });

    console.log(
      "\n📌 Step 2: Create active hold for session [为会话创建活跃预占]",
    );

    // Create an active hold for the session [为会话创建活跃预占]
    const [createdHold] = await db
      .insert(schema.serviceHolds)
      .values({
        studentId: testStudentId,
        serviceType: testServiceType,
        quantity: quantity,
        status: HoldStatus.ACTIVE,
        relatedBookingId: sessionId,
        createdBy: createdBy,
      })
      .returning();

    console.log("✅ Created active hold:", {
      holdId: createdHold.id,
      studentId: createdHold.studentId,
      serviceType: createdHold.serviceType,
      quantity: createdHold.quantity,
      status: createdHold.status,
      relatedBookingId: createdHold.relatedBookingId,
    });

    // Verify hold was created and entitlement updated (trigger should have increased held_quantity) [验证预占已创建且权益已更新（触发器应增加held_quantity）]
    const [afterHoldEntitlement] = await db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(
            schema.contractServiceEntitlements.studentId,
            testStudentId,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            testServiceType,
          ),
        ),
      )
      .limit(1);

    console.log("✅ Entitlement after hold creation:", {
      heldQuantity: afterHoldEntitlement.heldQuantity,
      consumedQuantity: afterHoldEntitlement.consumedQuantity,
    });

    expect(afterHoldEntitlement.heldQuantity).toBe(
      initialHeldQuantity + quantity,
    );

    console.log(
      "\n📌 Step 3: Emit SERVICE_SESSION_COMPLETED_EVENT event [触发SERVICE_SESSION_COMPLETED_EVENT事件]",
    );

    // Directly call the listener method to avoid EventEmitter timing issues [直接调用监听器方法以避免EventEmitter时序问题]
    // Use 0.9 hours so consumption quantity is 1 (Math.ceil(0.9) = 1) [使用0.9小时，这样消耗数量为1（Math.ceil(0.9) = 1）]
    const event = new ServiceSessionCompletedEvent({
      sessionId: sessionId,
      studentId: testStudentId,
      serviceTypeCode: testServiceType,
      actualDurationMinutes: 54, // 54分钟 = 0.9小时 = 1单位消耗
      durationMinutes: 120,
      allowBilling: true,
      sessionTypeCode: "regular_mentoring",
    });

    await sessionCompletedListener.handleServiceSessionCompletedEvent(event);

    console.log("✅ Event processed");

    console.log("\n📌 Step 4: Verify hold was released [验证预占已释放]");

    // Verify hold was released [验证预占已释放]
    const [releasedHold] = await db
      .select()
      .from(schema.serviceHolds)
      .where(eq(schema.serviceHolds.id, createdHold.id))
      .limit(1);

    console.log("✅ Hold after event processing:", {
      id: releasedHold.id,
      status: releasedHold.status,
      releasedAt: releasedHold.releasedAt,
      releaseReason: releasedHold.releaseReason,
    });

    expect(releasedHold.status).toBe(HoldStatus.RELEASED);
    expect(releasedHold.releasedAt).toBeDefined();
    expect(releasedHold.releaseReason).toBe("completed");

    console.log(
      "\n📌 Step 5: Verify entitlement held_quantity decreased [验证权益held_quantity减少]",
    );

    // Verify entitlement held_quantity decreased (trigger should have decreased held_quantity) [验证权益held_quantity减少（触发器应减少held_quantity）]
    const [afterReleaseEntitlement] = await db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(
            schema.contractServiceEntitlements.studentId,
            testStudentId,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            testServiceType,
          ),
        ),
      )
      .limit(1);

    console.log("✅ Entitlement after hold release:", {
      heldQuantity: afterReleaseEntitlement.heldQuantity,
      consumedQuantity: afterReleaseEntitlement.consumedQuantity,
    });

    expect(afterReleaseEntitlement.heldQuantity).toBe(initialHeldQuantity);

    console.log(
      "\n📌 Step 6: Verify consumption was recorded [验证消耗已记录]",
    );

    // Verify consumption was recorded [验证消耗已记录]
    const consumptionRecords = await db
      .select()
      .from(schema.serviceLedgers)
      .where(
        and(
          eq(schema.serviceLedgers.studentId, testStudentId),
          eq(schema.serviceLedgers.serviceType, testServiceType),
          eq(schema.serviceLedgers.relatedBookingId, sessionId),
          eq(schema.serviceLedgers.type, "consumption"),
        ),
      )
      .orderBy(schema.serviceLedgers.createdAt);

    expect(consumptionRecords.length).toBeGreaterThan(0);

    const consumption = consumptionRecords[0];
    console.log("✅ Consumption record created:", {
      id: consumption.id,
      studentId: consumption.studentId,
      serviceType: consumption.serviceType,
      quantity: consumption.quantity, // Should be negative for consumption [应为负值表示消耗]
      type: consumption.type,
      source: consumption.source,
      relatedBookingId: consumption.relatedBookingId,
      balanceAfter: consumption.balanceAfter,
    });

    expect(consumption.quantity).toBeLessThan(0); // Consumption should be negative [消耗应为负值]
    expect(consumption.type).toBe("consumption");
    expect(consumption.source).toBe("booking_completed");
    expect(consumption.relatedBookingId).toBe(sessionId);

    console.log(
      "\n📌 Step 7: Verify entitlement consumed_quantity increased [验证权益consumed_quantity增加]",
    );

    // Verify entitlement consumed_quantity increased (trigger should have increased consumed_quantity) [验证权益consumed_quantity增加（触发器应增加consumed_quantity）]
    const [afterConsumptionEntitlement] = await db
      .select()
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(
            schema.contractServiceEntitlements.studentId,
            testStudentId,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            testServiceType,
          ),
        ),
      )
      .limit(1);

    console.log("✅ Entitlement after consumption recorded:", {
      heldQuantity: afterConsumptionEntitlement.heldQuantity,
      consumedQuantity: afterConsumptionEntitlement.consumedQuantity,
    });

    // consumed_quantity should have increased by the consumption amount [consumed_quantity应增加消耗数量]
    expect(afterConsumptionEntitlement.consumedQuantity).toBeGreaterThan(
      initialConsumedQuantity,
    );

    console.log(
      "\n✅✅✅ All assertions passed! Test completed successfully! [所有断言通过！测试成功完成！]",
    );
  }, 60000);
});
