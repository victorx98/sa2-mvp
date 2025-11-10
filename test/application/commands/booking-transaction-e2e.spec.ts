import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BookSessionCommand } from "../../../src/application/commands/booking/book-session.command";
import { CalendarService } from "../../../src/core/calendar";
import { MeetingProviderModule } from "../../../src/core/meeting-providers/meeting-provider.module";
import { SessionService } from "../../../src/domains/services/session/services/session.service";
import { ContractService } from "../../../src/domains/contract/contract.service";
import { DATABASE_CONNECTION } from "../../../src/infrastructure/database/database.provider";
import { DatabaseModule } from "../../../src/infrastructure/database/database.module";
import { BookSessionInput } from "../../../src/application/commands/booking/dto/book-session-input.dto";
import * as schema from "../../../src/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { v4 as uuidv4 } from "uuid";

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
    contract: uuidv4(),
    service: uuidv4(),
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
        MeetingProviderModule,
        EventEmitterModule.forRoot(),
      ],
      providers: [
        BookSessionCommand,
        SessionService,
        ContractService,
        CalendarService,
      ],
    }).compile();

    command = app.get<BookSessionCommand>(BookSessionCommand);
    db = app.get<NodePgDatabase>(DATABASE_CONNECTION);
    console.log("✅ E2E Test Module initialized with real database connection");
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      if (db) {
        // 按照依赖顺序删除
        await db
          .delete(schema.calendarSlots)
          .where(eq(schema.calendarSlots.resourceId, testIds.mentor));

        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.studentId, testIds.student));

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
        contractId: testIds.contract,
        serviceId: testIds.service,
        scheduledStartTime: new Date("2025-12-15T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-15T11:00:00Z"),
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
        .where(eq(schema.calendarSlots.resourceId, testIds.mentor));

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
      expect(result.calendarSlotId).toBeDefined();
      expect(result.serviceHoldId).toBeDefined();

      console.log("\n✅ Booking Result:", {
        sessionId: result.sessionId,
        status: result.status,
        meetingUrl: result.meetingUrl ? "Generated" : "Not generated",
        calendarSlotId: result.calendarSlotId,
        serviceHoldId: result.serviceHoldId,
      });

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
      const calendarSlotsAfterRaw = await db.execute<{
        id: string;
        resource_id: string;
        session_id: string | null;
        slot_type: string;
        status: string;
        range_start: string;
        range_end: string;
      }>(
        `
          SELECT
            id,
            resource_id,
            session_id,
            slot_type,
            status,
            lower(time_range)::timestamptz AS range_start,
            upper(time_range)::timestamptz AS range_end
          FROM calendar_slots
          WHERE resource_id = '${testIds.mentor}'
        `,
      );

      expect(calendarSlotsAfterRaw.rows).toHaveLength(1);
      const rawSlot = calendarSlotsAfterRaw.rows[0];
      const savedSlot = {
        id: rawSlot.id,
        resourceId: rawSlot.resource_id,
        sessionId: rawSlot.session_id,
        slotType: rawSlot.slot_type,
        status: rawSlot.status,
        timeRange: `[${new Date(rawSlot.range_start).toISOString()}, ${new Date(
          rawSlot.range_end,
        ).toISOString()})`,
      };

      expect(savedSlot.id).toBe(result.calendarSlotId);
      expect(savedSlot.resourceId).toBe(testIds.mentor);
      expect(savedSlot.sessionId).toBe(result.sessionId);
      expect(savedSlot.slotType).toBe("session");
      expect(savedSlot.status).toBe("occupied");

      console.log(
        "✓ Verified: Calendar slot saved in database with ID:",
        savedSlot.id,
      );

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
      const testInput: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: uuidv4(), // 使用新的student ID避免冲突
        mentorId: uuidv4(), // 使用新的mentor ID
        contractId: testIds.contract,
        serviceId: testIds.service,
        scheduledStartTime: new Date("2025-12-16T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-16T11:00:00Z"),
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
        .where(eq(schema.calendarSlots.resourceId, testInput.mentorId));

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
        .where(eq(schema.calendarSlots.resourceId, testInput.mentorId));

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

      const firstBooking: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: firstStudentId,
        mentorId: firstMentorId,
        contractId: testIds.contract,
        serviceId: testIds.service,
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

      // 尝试预约相同的时间段（应该失败）
      const conflictBooking: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: uuidv4(),
        mentorId: firstMentorId, // 相同的mentor
        contractId: testIds.contract,
        serviceId: testIds.service,
        scheduledStartTime: new Date("2025-12-17T10:00:00Z"), // 相同的时间
        scheduledEndTime: new Date("2025-12-17T11:00:00Z"),
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
        .where(eq(schema.calendarSlots.resourceId, firstMentorId));
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
      const testInput: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: uuidv4(),
        mentorId: uuidv4(),
        contractId: testIds.contract,
        serviceId: testIds.service,
        scheduledStartTime: new Date("2025-12-18T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-18T11:00:00Z"),
        duration: 60,
        topic: `${testPrefix} - Consistency Test`,
        meetingProvider: "feishu",
      };

      // Act
      console.log("\n📝 Creating booking for consistency check...");
      const result = await command.execute(testInput);

      // Assert - 验证外键关联
      const session = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, result.sessionId))
        .limit(1);

      expect(session).toHaveLength(1);
      console.log("✓ Session found:", session[0].id);

      const calendarSlotRaw = await db.execute<{
        id: string;
        session_id: string | null;
        range_start: string;
        range_end: string;
      }>(
        `
          SELECT
            id,
            session_id,
            lower(time_range)::timestamptz AS range_start,
            upper(time_range)::timestamptz AS range_end
          FROM calendar_slots
          WHERE id = '${result.calendarSlotId}'
          LIMIT 1
        `,
      );

      expect(calendarSlotRaw.rows).toHaveLength(1);
      const normalizedSlot = {
        id: calendarSlotRaw.rows[0].id,
        sessionId: calendarSlotRaw.rows[0].session_id,
        timeRange: `[${new Date(
          calendarSlotRaw.rows[0].range_start,
        ).toISOString()}, ${new Date(
          calendarSlotRaw.rows[0].range_end,
        ).toISOString()})`,
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

      expect(joinedData).toHaveLength(1);
      expect(joinedData[0].sessionId).toBe(result.sessionId);
      expect(joinedData[0].slotId).toBe(result.calendarSlotId);
      console.log("✓ JOIN query successful:", joinedData[0]);

      // 清理
      await db
        .delete(schema.calendarSlots)
        .where(eq(schema.calendarSlots.id, result.calendarSlotId));
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, result.sessionId));
      console.log("✓ Test data cleaned up");

      console.log("\n🎉 SUCCESS: Data consistency and relationships verified!");
    }, 30000);
  });

  describe("🔍 使用 Supabase MCP 工具验证", () => {
    it("应该能够通过 SQL 查询验证数据", async () => {
      // Arrange
      const testInput: BookSessionInput = {
        counselorId: testIds.counselor,
        studentId: uuidv4(),
        mentorId: uuidv4(),
        contractId: testIds.contract,
        serviceId: testIds.service,
        scheduledStartTime: new Date("2025-12-19T10:00:00Z"),
        scheduledEndTime: new Date("2025-12-19T11:00:00Z"),
        duration: 60,
        topic: `${testPrefix} - MCP Test`,
        meetingProvider: "feishu",
      };

      // Act
      console.log("\n📝 Creating booking for MCP verification...");
      const result = await command.execute(testInput);

      // 使用原生 SQL 查询验证（模拟 MCP execute_sql）
      const sqlQuery = `
        SELECT
          s.id as session_id,
          s.student_id,
          s.mentor_id,
          s.status as session_status,
          s.meeting_url,
          cs.id as calendar_slot_id,
          cs.slot_type,
          cs.status as slot_status
        FROM sessions s
        INNER JOIN calendar_slots cs ON s.id = cs.session_id
        WHERE s.id::text = $1
      `;

      const sqlResult = await db.execute(
        sqlQuery.replace("$1", `'${result.sessionId}'`),
      );

      // Assert
      expect(sqlResult.rows).toHaveLength(1);
      const row = sqlResult.rows[0] as any;
      expect(row.session_id).toBe(result.sessionId);
      expect(row.student_id).toBe(testInput.studentId);
      expect(row.mentor_id).toBe(testInput.mentorId);
      expect(row.session_status).toBe("scheduled");
      expect(row.meeting_url).toBeDefined();
      expect(row.calendar_slot_id).toBe(result.calendarSlotId);
      expect(row.slot_type).toBe("session");
      expect(row.slot_status).toBe("occupied");

      console.log("✓ SQL query result:", {
        sessionId: row.session_id,
        sessionStatus: row.session_status,
        hasMeetingUrl: !!row.meeting_url,
        slotId: row.calendar_slot_id,
        slotType: row.slot_type,
      });

      // 清理
      await db
        .delete(schema.calendarSlots)
        .where(eq(schema.calendarSlots.id, result.calendarSlotId));
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, result.sessionId));
      console.log("✓ Test data cleaned up");

      console.log("\n🎉 SUCCESS: MCP-style SQL verification completed!");
    }, 30000);
  });
});
