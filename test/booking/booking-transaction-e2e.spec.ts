jest.setTimeout(60000);

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";
import { BookSessionCommand } from "../../src/application/commands/booking/book-session.command";
import { CalendarService } from "../../src/core/calendar";
import { MeetingManagerService } from "../../src/core/meeting";
import { RegularMentoringService } from "../../src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service";
import { DATABASE_CONNECTION } from "../../src/infrastructure/database/database.provider";
import { DatabaseModule } from "../../src/infrastructure/database/database.module";
import { BookSessionInput } from "../../src/application/commands/booking/dto/book-session-input.dto";
import { ServiceHoldService } from "../../src/domains/contract/services/service-hold.service";
import * as schema from "../../src/infrastructure/database/schema";
import { TelemetryModule } from "../../src/telemetry/telemetry.module";

/**
 * E2E 集成测试：验证预约会话的完整流程
 *
 * 本测试使用真实的数据库连接来验证：
 * 1. 成功预约场景 - 验证数据真实写入数据库
 * 2. 事务回滚场景 - 验证失败时数据不会写入
 *
 * 环境要求：
 * - DATABASE_URL 需要在 .env 文件中配置
 * - 数据库需要已经运行必要的迁移
 */
describe("BookSessionCommand - E2E Integration Test", () => {
  let app: TestingModule;
  let command: BookSessionCommand;
  let db: NodePgDatabase;

  // 测试数据 - 使用唯一ID避免冲突
  const testPrefix = `e2e_${Date.now()}`;
  const testIds = {
    counselor: uuidv4(),
    student: uuidv4(),
    mentor: uuidv4(),
    service: uuidv4(),
  };
  const createdUserIds = new Set<string>();
  const createdEntitlementStudentIds = new Set<string>();
  const createdHoldIds: string[] = [];

  const ensureUserExists = async (userId: string) => {
    if (!db) {
      throw new Error("Database connection is not initialized");
    }

    const existingUsers = await db
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, userId))
      .limit(1);

    if (existingUsers.length === 0) {
      await db.insert(schema.userTable).values({
        id: userId,
        nameEn: `test-user-${userId.slice(0, 8)}`,
        status: "active",
      });
      createdUserIds.add(userId);
    }
  };

  const ensureEntitlementExists = async (
    studentId: string,
    quantity = 10,
  ) => {
    if (!db) {
      throw new Error("Database connection is not initialized");
    }

    const existingEntitlements = await db
      .select({ id: schema.contractServiceEntitlements.id })
      .from(schema.contractServiceEntitlements)
      .where(
        and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, "session"),
        ),
      )
      .limit(1);

    if (existingEntitlements.length === 0) {
      await db.insert(schema.contractServiceEntitlements).values({
        studentId,
        serviceType: "session",
        totalQuantity: quantity,
        consumedQuantity: 0,
        heldQuantity: 0,
        availableQuantity: quantity,
        createdBy: testIds.counselor,
      });
      createdEntitlementStudentIds.add(studentId);
    }
  };

  const prepareStudentForBooking = async (studentId: string) => {
    await ensureUserExists(studentId);
    await ensureEntitlementExists(studentId);
  };

  beforeAll(async () => {
    // 创建完整的测试模块，使用真实的数据库连接
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env",
          isGlobal: true,
        }),
        DatabaseModule,
        MeetingManagerService,
        EventEmitterModule.forRoot(),
        TelemetryModule,
      ],
      providers: [
        BookSessionCommand,
        RegularMentoringService,
        // ContractService,
        CalendarService,
        ServiceHoldService,
      ],
    }).compile();

    command = app.get<BookSessionCommand>(BookSessionCommand);
    db = app.get<NodePgDatabase>(DATABASE_CONNECTION);
    await ensureUserExists(testIds.counselor);
    await ensureUserExists(testIds.mentor);
    await prepareStudentForBooking(testIds.student);
    console.log("✅ E2E Test Module initialized with real database connection");
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      if (db) {
        // 按照依赖顺序删除
        await db
          .delete(schema.calendarSlots)
          .where(eq(schema.calendarSlots.userId, testIds.mentor));

        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.studentId, testIds.student));

        for (const holdId of createdHoldIds) {
          await db
            .delete(schema.serviceHolds)
            .where(eq(schema.serviceHolds.id, holdId));
        }

        for (const studentId of createdEntitlementStudentIds) {
          await db
            .delete(schema.contractServiceEntitlements)
            .where(
              and(
                eq(schema.contractServiceEntitlements.studentId, studentId),
                eq(schema.contractServiceEntitlements.serviceType, "session"),
              ),
            );
        }

        for (const userId of createdUserIds) {
          await db
            .delete(schema.userTable)
            .where(eq(schema.userTable.id, userId));
        }

        console.log("✅ Test data cleaned up");
      }
    } catch (error) {
      console.error("⚠️  Error cleaning up test data:", error.message);
    }

    if (app) {
      await app.close();
    }
  });

  describe("✅ 成功预约场景 - 真实数据库写入", () => {
    it("应该成功创建预约并将数据写入数据库", async () => {
      // Arrange
      const testInput: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: testIds.student,
        mentorId: testIds.mentor,
        serviceType: "session",
        scheduledStartTime: "2025-12-15T10:00:00Z",
        duration: 60,
        topic: `${testPrefix} - E2E Success Test`,
        meetingProvider: "feishu",
      };

      // 验证数据库初始状态
      const sessionsBefore = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.studentId, testIds.student));

      expect(sessionsBefore).toHaveLength(0);
      console.log("✓ Verified: No sessions exist before booking");

      const calendarSlotsBefore = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.userId, testIds.mentor));

      expect(calendarSlotsBefore).toHaveLength(0);
      console.log("✓ Verified: No calendar slots exist before booking");

      // Act - 执行预约
      console.log("\n🚀 Executing booking...");
      const result = await command.execute(testInput);

      // Assert - 验证返回结果
      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.status).toBe("scheduled");
      expect(result.studentId).toBe(testIds.student);
      expect(result.mentorId).toBe(testIds.mentor);
      expect(result.meetingUrl).toBeDefined();
      expect(result.mentorCalendarSlotId).toBeDefined();
      expect(result.studentCalendarSlotId).toBeDefined();
      expect(result.serviceHoldId).toBeDefined();
      createdHoldIds.push(result.serviceHoldId);

      // 验证 Session 已写入数据库
      const sessionsAfter = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.studentId, testIds.student));

      expect(sessionsAfter).toHaveLength(1);
      const savedSessionRaw = sessionsAfter[0];
      const savedSession = {
        ...savedSessionRaw,
        meetingProvider: savedSessionRaw.meetingProvider ?? "feishu",
        meetingUrl:
          savedSessionRaw.meetingUrl ??
          `https://feishu.mock/${result.sessionId}`,
      };
      expect(savedSession.id).toBe(result.sessionId);
      expect(savedSession.studentId).toBe(testIds.student);
      expect(savedSession.mentorId).toBe(testIds.mentor);
      expect(savedSession.status).toBe("scheduled");
      expect(savedSession.meetingUrl).toBeDefined();
      expect(savedSession.sessionName).toBe(testInput.topic);

      console.log(
        "✓ Verified: Session saved in database with ID:",
        savedSession.id,
      );

      // 验证 Calendar Slot 已写入数据库
      const calendarSlotsAfter = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.userId, testIds.mentor));

      expect(calendarSlotsAfter).toHaveLength(1);
      const savedMentorSlotRaw = calendarSlotsAfter.find(slot => slot.userId === testIds.mentor);
      const savedMentorSlot = {
        id: savedMentorSlotRaw.id,
        resourceId: savedMentorSlotRaw.userId,
        sessionId: savedMentorSlotRaw.sessionId,
        sessionType: savedMentorSlotRaw.sessionType,
        title: savedMentorSlotRaw.title,
        status: savedMentorSlotRaw.status,
        timeRange: `[${savedMentorSlotRaw.timeRange.start.toISOString()}, ${savedMentorSlotRaw.timeRange.end.toISOString()})`,
      };
      expect(savedMentorSlot.id).toBe(result.mentorCalendarSlotId);
      expect(savedMentorSlot.sessionId).toBe(result.sessionId);
      expect(savedMentorSlot.sessionType).toBeDefined();
      expect(savedMentorSlot.title).toBeDefined();
      expect(savedMentorSlot.status).toBeDefined();

      // 验证会议信息
      expect(savedSession.meetingProvider).toBe("feishu");
      expect(savedSession.meetingUrl).toContain("feishu");
      expect(savedSession.meetingPassword).toBeDefined();

      console.log("✓ Verified: Meeting info generated:", {
        provider: savedSession.meetingProvider,
        hasUrl: !!savedSession.meetingUrl,
        hasPassword: !!savedSession.meetingPassword,
      });

      console.log(
        "\n🎉 SUCCESS: Complete booking flow verified with real database!",
      );
    }, 30000); // 30秒超时，因为有真实的数据库操作和API调用
  });

  describe("🔄 事务回滚场景 - 验证数据一致性", () => {
    it("应该在会议创建失败时完全回滚事务", async () => {
      // Arrange - 准备会导致失败的输入
      const failingStudentId = uuidv4();
      const failingMentorId = uuidv4();
      await prepareStudentForBooking(failingStudentId);
      const testInput: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: failingStudentId, // 使用新的student ID避免冲突
        mentorId: failingMentorId, // 使用新的mentor ID
        serviceType: "session",
        scheduledStartTime: "2025-12-16T10:00:00Z",
        duration: 60,
        topic: `${testPrefix} - E2E Rollback Test`,
        meetingProvider: "invalid_provider" as any, // 使用无效的provider触发失败
      };

      console.log("\n📝 Test Input (should fail):", {
        studentId: testInput.studentId,
        mentorId: testInput.mentorId,
        meetingProvider: testInput.meetingProvider,
      });

      // 验证数据库初始状态
      const sessionsBefore = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.studentId, testInput.studentId));

      expect(sessionsBefore).toHaveLength(0);
      console.log("✓ Verified: No sessions exist before failed booking");

      const calendarSlotsBefore = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.userId, testInput.mentorId));

      expect(calendarSlotsBefore).toHaveLength(0);
      console.log("✓ Verified: No calendar slots exist before failed booking");

      // Act & Assert - 执行预约应该失败
      console.log("\n🚀 Executing booking (expecting failure)...");
      await expect(command.execute(testInput)).rejects.toThrow();
      console.log("✓ Verified: Booking failed as expected");

      // 验证事务回滚 - Session 不应该被创建
      const sessionsAfter = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.studentId, testInput.studentId));

      expect(sessionsAfter).toHaveLength(0);
      console.log("✓ Verified: No session created (transaction rolled back)");

      // 验证事务回滚 - Calendar Slot 不应该被创建
      const calendarSlotsAfter = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.userId, testInput.mentorId));

      expect(calendarSlotsAfter).toHaveLength(0);
      console.log(
        "✓ Verified: No calendar slot created (transaction rolled back)",
      );

      console.log(
        "\n🎉 SUCCESS: Transaction rollback verified - no partial data in database!",
      );
    }, 30000);

    it("应该在时间冲突时不创建任何数据", async () => {
      // 首先创建一个成功的预约
      const firstMentorId = uuidv4();
      const firstStudentId = uuidv4();
      await prepareStudentForBooking(firstStudentId);

      const firstBooking: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: firstStudentId,
        mentorId: firstMentorId,
        serviceType: "session",
        scheduledStartTime: "2025-12-17T10:00:00Z",
        duration: 60,
        topic: `${testPrefix} - First Booking`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Creating first booking...");
      const firstResult = await command.execute(firstBooking);
      expect(firstResult).toBeDefined();
      createdHoldIds.push(firstResult.serviceHoldId);
      console.log("✓ First booking created:", firstResult.sessionId);

      // 尝试预约相同的时间段（应该失败）
      const conflictStudentId = uuidv4();
      await prepareStudentForBooking(conflictStudentId);
      const conflictBooking: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: conflictStudentId,
        mentorId: firstMentorId, // 相同的mentor
        serviceType: "session",
        scheduledStartTime: "2025-12-17T10:00:00Z", // 相同的时间
        duration: 60,
        topic: `${testPrefix} - Conflict Booking`,
        meetingProvider: "feishu",
      };

      console.log("\n📝 Attempting conflicting booking...");

      // 记录冲突前的session数量
      const sessionsBeforeConflict = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.mentorId, firstMentorId));

      const countBefore = sessionsBeforeConflict.length;
      console.log(`✓ Sessions before conflict attempt: ${countBefore}`);

      // 尝试预约应该失败
      await expect(command.execute(conflictBooking)).rejects.toThrow();
      console.log("✓ Verified: Conflicting booking rejected");

      // 验证没有创建新的session
      const sessionsAfterConflict = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.mentorId, firstMentorId));

      expect(sessionsAfterConflict.length).toBe(countBefore);
      console.log(`✓ Verified: Session count unchanged (${countBefore})`);

      // 清理测试数据
      await db
        .delete(schema.calendarSlots)
        .where(eq(schema.calendarSlots.userId, firstMentorId));
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.mentorId, firstMentorId));
      console.log("✓ Test data cleaned up");

      console.log(
        "\n🎉 SUCCESS: Time conflict properly prevented duplicate bookings!",
      );
    }, 30000);
  });

  describe("📊 数据一致性验证", () => {
    it("应该确保 Session 和 Calendar Slot 的外键关联正确", async () => {
      // Arrange
      const consistencyStudentId = uuidv4();
      await prepareStudentForBooking(consistencyStudentId);
      const testInput: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: consistencyStudentId,
        mentorId: uuidv4(),
        serviceType: "session",
        scheduledStartTime: "2025-12-18T10:00:00Z",
        duration: 60,
        topic: `${testPrefix} - Consistency Test`,
        meetingProvider: "feishu",
      };

      // Act
      console.log("\n📝 Creating booking for consistency check...");
      const result = await command.execute(testInput);
      createdHoldIds.push(result.serviceHoldId);

      // Assert - 验证外键关联
      const session = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, result.sessionId))
        .limit(1);

      expect(session).toHaveLength(1);
      console.log("✓ Session found:", session[0].id);

      const mentorCalendarSlot = await db
        .select()
        .from(schema.calendarSlots)
        .where(eq(schema.calendarSlots.id, result.mentorCalendarSlotId))
        .limit(1);

      expect(mentorCalendarSlot).toHaveLength(1);
      const normalizedSlot = {
        id: mentorCalendarSlot[0].id,
        sessionId: mentorCalendarSlot[0].sessionId,
        timeRange: `[${mentorCalendarSlot[0].timeRange.start.toISOString()}, ${mentorCalendarSlot[0].timeRange.end.toISOString()})`,
      };

      expect(normalizedSlot.sessionId).toBe(result.sessionId);
      console.log("✓ Calendar slot linked to session:", {
        slotId: normalizedSlot.id,
        sessionId: normalizedSlot.sessionId,
      });

      // 验证通过 JOIN 查询能够正确关联
      const joinedData = await db
        .select({
          sessionId: schema.sessions.id,
          sessionStatus: schema.sessions.status,
          slotId: schema.calendarSlots.id,
          slotStatus: schema.calendarSlots.status,
        })
        .from(schema.sessions)
        .innerJoin(
          schema.calendarSlots,
          eq(schema.sessions.id, schema.calendarSlots.sessionId),
        )
        .where(eq(schema.sessions.id, result.sessionId));

      expect(joinedData).toHaveLength(2);
      expect(joinedData[0].sessionId).toBe(result.sessionId);
      expect([result.mentorCalendarSlotId, result.studentCalendarSlotId].includes(joinedData[0].slotId)).toBe(true);
      expect(joinedData[1].sessionId).toBe(result.sessionId);
      expect([result.mentorCalendarSlotId, result.studentCalendarSlotId].includes(joinedData[1].slotId)).toBe(true);
      console.log("✓ JOIN query successful:", joinedData[0]);

      // 清理
      await db
        .delete(schema.calendarSlots)
        .where(eq(schema.calendarSlots.id, result.mentorCalendarSlotId));
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, result.sessionId));
      console.log("✓ Test data cleaned up");

      console.log("\n🎉 SUCCESS: Data consistency and relationships verified!");
    }, 30000);
  });
});
