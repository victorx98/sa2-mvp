import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  SERVICE_SESSION_COMPLETED_EVENT,
  IServiceSessionCompletedEvent,
} from "@shared/events/service-session-completed.event";
import { SessionCompletedListener } from "@domains/contract/events/listeners/session-completed-listener";
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
  let eventEmitter: EventEmitter2;
  let sessionCompletedListener: SessionCompletedListener;
  let serviceHoldService: ServiceHoldService;
  let serviceLedgerService: ServiceLedgerService;
  let db: DrizzleDatabase;
  let testDatabaseHelper: TestDatabaseHelper;

  // Hard-coded test data from database (DO NOT DELETE) [从数据库硬编码的测试数据（不要删除）]
  // Query results from Supabase MCP:
  // SELECT student_id, service_type, total_quantity, consumed_quantity, held_quantity FROM contract_service_entitlements WHERE (total_quantity - consumed_quantity - held_quantity) > 2 LIMIT 1;
  // SELECT "id" FROM "user" LIMIT 1;
  const HARD_CODED_STUDENT_ID = "f2c3737c-1b37-4736-8633-251731ddcdec";
  const HARD_CODED_SERVICE_TYPE = "\tInternal"; // Service type code from service_types table (note: includes tab character) [服务类型代码（注意：包含制表符）]
  const HARD_CODED_USER_ID = "9729ec8c-ce51-43f0-85de-3b1bc410952d"; // Valid user UUID for createdBy field

  beforeAll(async () => {
    // Initialize test database connection
    testDatabaseHelper = await createTestDatabaseHelper();
    db = testDatabaseHelper.getDatabase();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EventEmitter2,
        SessionCompletedListener,
        ServiceHoldService,
        ServiceLedgerService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);
    sessionCompletedListener = moduleRef.get<SessionCompletedListener>(
      SessionCompletedListener,
    );
    serviceHoldService = moduleRef.get<ServiceHoldService>(ServiceHoldService);
    serviceLedgerService =
      moduleRef.get<ServiceLedgerService>(ServiceLedgerService);

    console.log("✅ Test setup complete [测试设置完成]");
    console.log("📋 Hard-coded test data:", {
      studentId: HARD_CODED_STUDENT_ID,
      serviceType: HARD_CODED_SERVICE_TYPE,
      userId: HARD_CODED_USER_ID,
    });
  }, 30000);

  it("should release hold and record consumption when session completes [当会话完成时应该释放预占并记录消耗]", async () => {
    // Arrange [准备]
    const sessionId = randomUUID();
    const createdBy = HARD_CODED_USER_ID; // Must be a valid UUID from user table
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
            HARD_CODED_STUDENT_ID,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            HARD_CODED_SERVICE_TYPE,
          ),
        ),
      )
      .limit(1);

    if (!initialEntitlement) {
      throw new Error(
        "Initial entitlement not found. Ensure hard-coded data exists in database.",
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
        studentId: HARD_CODED_STUDENT_ID,
        serviceType: HARD_CODED_SERVICE_TYPE,
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
            HARD_CODED_STUDENT_ID,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            HARD_CODED_SERVICE_TYPE,
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
    const event: IServiceSessionCompletedEvent = {
      id: randomUUID(),
      type: SERVICE_SESSION_COMPLETED_EVENT,
      timestamp: Date.now(),
      payload: {
        sessionId: sessionId,
        studentId: HARD_CODED_STUDENT_ID,
        mentorId: randomUUID(),
        serviceTypeCode: HARD_CODED_SERVICE_TYPE,
        actualDurationMinutes: 54, // 54分钟 = 0.9小时 = 1单位消耗
        durationMinutes: 120,
        allowBilling: true,
        sessionTypeCode: "regular_mentoring",
      },
    };

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
            HARD_CODED_STUDENT_ID,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            HARD_CODED_SERVICE_TYPE,
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
          eq(schema.serviceLedgers.studentId, HARD_CODED_STUDENT_ID),
          eq(schema.serviceLedgers.serviceType, HARD_CODED_SERVICE_TYPE),
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
            HARD_CODED_STUDENT_ID,
          ),
          eq(
            schema.contractServiceEntitlements.serviceType,
            HARD_CODED_SERVICE_TYPE,
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
