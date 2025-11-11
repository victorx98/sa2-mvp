import { Test, TestingModule } from "@nestjs/testing";
import { CalendarService } from "./calendar.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  CalendarException,
  CalendarNotFoundException,
} from "../exceptions/calendar.exception";
import { CreateSlotDto } from "../dto/create-slot.dto";
import { QuerySlotDto } from "../dto/query-slot.dto";
import {
  UserType,
  SlotType,
  SlotStatus,
} from "../interfaces/calendar-slot.interface";

describe("CalendarService", () => {
  let service: CalendarService;
  let mockDb: unknown;

  /**
   * Create mock database connection
   */
  const createMockDb = () => ({
    execute: jest.fn(),
    transaction: jest.fn(),
  });

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSlotDirect", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const validDto: CreateSlotDto = {
      userId: "user-id-123",
      userType: UserType.MENTOR,
      startTime: futureDate.toISOString(),
      durationMinutes: 60,
      slotType: SlotType.SESSION,
      sessionId: "session-id-123",
    };

    /**
     * Test: Successfully create slot when no conflict
     */
    it("should create slot successfully when no conflict", async () => {
      const mockSlot = {
        id: "slot-id-123",
        user_id: "user-id-123",
        user_type: UserType.MENTOR,
        time_range: `[${futureDate.toISOString()}, ${new Date(
          futureDate.getTime() + 60 * 60000,
        ).toISOString()})`,
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: SlotType.SESSION,
        status: SlotStatus.BOOKED,
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [mockSlot],
      });

      const result = await service.createSlotDirect(validDto);

      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-id-123");
      expect(result?.userType).toBe(UserType.MENTOR);
      expect(result?.status).toBe(SlotStatus.BOOKED);
      expect(result?.durationMinutes).toBe(60);
    });

    /**
     * Test: Return null when EXCLUDE constraint conflict (23P01)
     */
    it("should return null when conflict (23P01)", async () => {
      const error = new Error("conflict violation");
      error.message = "23P01";
      (mockDb as { execute: jest.Mock }).execute.mockRejectedValue(error);

      const result = await service.createSlotDirect(validDto);

      expect(result).toBeNull();
    });

    /**
     * Test: Throw exception for invalid duration
     */
    it("should throw exception for invalid duration (too short)", async () => {
      const invalidDto: CreateSlotDto = {
        ...validDto,
        durationMinutes: 15,
      };

      await expect(service.createSlotDirect(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });

    /**
     * Test: Throw exception for invalid duration (too long)
     */
    it("should throw exception for invalid duration (too long)", async () => {
      const invalidDto: CreateSlotDto = {
        ...validDto,
        durationMinutes: 240,
      };

      await expect(service.createSlotDirect(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });

    /**
     * Test: Throw exception for past start time
     */
    it("should throw exception for past start time", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const invalidDto: CreateSlotDto = {
        ...validDto,
        startTime: pastDate.toISOString(),
      };

      await expect(service.createSlotDirect(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });
  });

  describe("isSlotAvailable", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    /**
     * Test: Return true when slot is available
     */
    it("should return true when no overlapping slots", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [{ count: "0" }],
      });

      const result = await service.isSlotAvailable(
        "user-id-123",
        UserType.MENTOR,
        futureDate,
        60,
      );

      expect(result).toBe(true);
    });

    /**
     * Test: Return false when slot is occupied
     */
    it("should return false when slot is occupied", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [{ count: "1" }],
      });

      const result = await service.isSlotAvailable(
        "user-id-123",
        UserType.MENTOR,
        futureDate,
        60,
      );

      expect(result).toBe(false);
    });

    /**
     * Test: Throw exception for past start time
     */
    it("should throw exception for past start time", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await expect(
        service.isSlotAvailable("user-id-123", UserType.MENTOR, pastDate, 60),
      ).rejects.toThrow(CalendarException);
    });

    /**
     * Test: Throw exception for invalid duration
     */
    it("should throw exception for invalid duration", async () => {
      await expect(
        service.isSlotAvailable("user-id-123", UserType.MENTOR, futureDate, 15),
      ).rejects.toThrow(CalendarException);
    });
  });

  describe("releaseSlot", () => {
    /**
     * Test: Successfully release slot
     */
    it("should release slot successfully", async () => {
      const existingSlot = {
        id: "slot-id-123",
        user_id: "user-id-123",
        user_type: UserType.MENTOR,
        time_range: "[2025-11-20T10:00:00Z, 2025-11-20T11:00:00Z)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: SlotType.SESSION,
        status: SlotStatus.BOOKED,
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedSlot = {
        ...existingSlot,
        status: SlotStatus.CANCELLED,
      };

      (mockDb as { execute: jest.Mock }).execute
        .mockResolvedValueOnce({ rows: [existingSlot] }) // getSlotById
        .mockResolvedValueOnce({ rows: [updatedSlot] }); // releaseSlot UPDATE

      const result = await service.releaseSlot("slot-id-123");

      expect(result.status).toBe(SlotStatus.CANCELLED);
    });

    /**
     * Test: Throw exception when slot not found
     */
    it("should throw exception when slot not found", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [],
      });

      await expect(service.releaseSlot("slot-id-999")).rejects.toThrow(
        CalendarNotFoundException,
      );
    });

    /**
     * Test: Throw exception when slot already cancelled
     */
    it("should throw exception when slot already cancelled", async () => {
      const cancelledSlot = {
        id: "slot-id-123",
        user_id: "user-id-123",
        user_type: UserType.MENTOR,
        time_range: "[2025-11-20T10:00:00Z, 2025-11-20T11:00:00Z)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: SlotType.SESSION,
        status: SlotStatus.CANCELLED,
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [cancelledSlot],
      });

      await expect(service.releaseSlot("slot-id-123")).rejects.toThrow(
        CalendarException,
      );
    });
  });

  describe("getBookedSlots", () => {
    /**
     * Test: Get booked slots successfully
     */
    it("should get booked slots successfully", async () => {
      const mockSlots = [
        {
          id: "slot-1",
          user_id: "user-id-123",
          user_type: UserType.MENTOR,
          time_range: "[2025-11-20T10:00:00Z, 2025-11-20T11:00:00Z)",
          duration_minutes: 60,
          session_id: "session-1",
          slot_type: SlotType.SESSION,
          status: SlotStatus.BOOKED,
          reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "slot-2",
          user_id: "user-id-123",
          user_type: UserType.MENTOR,
          time_range: "[2025-11-21T10:00:00Z, 2025-11-21T11:00:00Z)",
          duration_minutes: 60,
          session_id: "session-2",
          slot_type: SlotType.SESSION,
          status: SlotStatus.BOOKED,
          reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: mockSlots,
      });

      const dto: QuerySlotDto = {
        userId: "user-id-123",
        userType: UserType.MENTOR,
      };

      const result = await service.getBookedSlots(dto);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe("user-id-123");
    });

    /**
     * Test: Throw exception for date range > 90 days
     */
    it("should throw exception for date range > 90 days", async () => {
      const dto: QuerySlotDto = {
        userId: "user-id-123",
        userType: UserType.MENTOR,
        dateFrom: "2025-11-10T00:00:00Z",
        dateTo: "2026-02-10T00:00:00Z", // 92 days later
      };

      await expect(service.getBookedSlots(dto)).rejects.toThrow(
        CalendarException,
      );
    });
  });

  describe("getSlotBySessionId", () => {
    /**
     * Test: Get slot by session ID
     */
    it("should get slot by session ID", async () => {
      const mockSlot = {
        id: "slot-id-123",
        user_id: "user-id-123",
        user_type: UserType.MENTOR,
        time_range: "[2025-11-20T10:00:00Z, 2025-11-20T11:00:00Z)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: SlotType.SESSION,
        status: SlotStatus.BOOKED,
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [mockSlot],
      });

      const result = await service.getSlotBySessionId("session-id-123");

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe("session-id-123");
    });

    /**
     * Test: Return null when session not found
     */
    it("should return null when session not found", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [],
      });

      const result = await service.getSlotBySessionId("session-not-found");

      expect(result).toBeNull();
    });
  });

  describe("updateSlotSessionId", () => {
    /**
     * Test: Update slot with session ID
     */
    it("should update slot with session ID", async () => {
      const mockSlot = {
        id: "slot-id-123",
        user_id: "user-id-123",
        user_type: UserType.MENTOR,
        time_range: "[2025-11-20T10:00:00Z, 2025-11-20T11:00:00Z)",
        duration_minutes: 60,
        session_id: "session-id-456",
        slot_type: SlotType.SESSION,
        status: SlotStatus.BOOKED,
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [mockSlot],
      });

      const result = await service.updateSlotSessionId(
        "slot-id-123",
        "session-id-456",
      );

      expect(result.sessionId).toBe("session-id-456");
    });

    /**
     * Test: Throw exception when slot not found
     */
    it("should throw exception when slot not found", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [],
      });

      await expect(
        service.updateSlotSessionId("slot-not-found", "session-id-123"),
      ).rejects.toThrow(CalendarNotFoundException);
    });
  });
});
