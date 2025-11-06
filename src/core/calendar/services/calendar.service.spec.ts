import { Test, TestingModule } from "@nestjs/testing";
import { CalendarService } from "./calendar.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  CalendarException,
  CalendarNotFoundException,
  CalendarConflictException,
} from "../exceptions/calendar.exception";
import { CreateSlotDto } from "../dto/create-slot.dto";
import { QuerySlotDto } from "../dto/query-slot.dto";
import {
  ResourceType,
  SlotType,
  SlotStatus,
} from "../interfaces/calendar-slot.interface";

describe("CalendarService", () => {
  let service: CalendarService;
  let mockDb: unknown;

  // Mock database connection
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

  describe("isSlotAvailable", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

    it("should return true when slot is available", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [{ count: "0" }],
      });

      const result = await service.isSlotAvailable(
        ResourceType.MENTOR,
        "mentor-id-123",
        futureDate,
        60,
      );

      expect(result).toBe(true);
    });

    it("should return false when slot is occupied", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [{ count: "1" }],
      });

      const result = await service.isSlotAvailable(
        ResourceType.MENTOR,
        "mentor-id-123",
        futureDate,
        60,
      );

      expect(result).toBe(false);
    });

    it("should throw error when start time is in the past", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await expect(
        service.isSlotAvailable(
          ResourceType.MENTOR,
          "mentor-id-123",
          pastDate,
          60,
        ),
      ).rejects.toThrow(CalendarException);
    });
  });

  describe("createOccupiedSlot", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const validDto: CreateSlotDto = {
      resourceType: ResourceType.MENTOR,
      resourceId: "mentor-id-123",
      startTime: futureDate.toISOString(),
      durationMinutes: 60,
      slotType: SlotType.SESSION,
      sessionId: "session-id-123",
    };

    it("should create occupied slot when available", async () => {
      const mockSlot = {
        id: "slot-id-123",
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: `[${futureDate.toISOString()}, ${new Date(futureDate.getTime() + 60 * 60000).toISOString()})`,
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: "session",
        status: "occupied",
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock availability check
      (mockDb as { execute: jest.Mock }).execute
        .mockResolvedValueOnce({ rows: [{ count: "0" }] }) // isSlotAvailable
        .mockResolvedValueOnce({ rows: [mockSlot] }); // create

      const result = await service.createOccupiedSlot(validDto);

      expect(result).toBeDefined();
      expect(result.resourceType).toBe(ResourceType.MENTOR);
    });

    it("should throw conflict error when slot is not available", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [{ count: "1" }],
      });

      await expect(service.createOccupiedSlot(validDto)).rejects.toThrow(
        CalendarConflictException,
      );
    });

    it("should throw error when duration is less than 30", async () => {
      const invalidDto = { ...validDto, durationMinutes: 20 };

      await expect(service.createOccupiedSlot(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });

    it("should throw error when duration is more than 180", async () => {
      const invalidDto = { ...validDto, durationMinutes: 200 };

      await expect(service.createOccupiedSlot(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });

    it("should throw error when start time is in the past", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const invalidDto = { ...validDto, startTime: pastDate.toISOString() };

      await expect(service.createOccupiedSlot(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });
  });

  describe("releaseSlot", () => {
    const slotId = "slot-id-123";

    it("should release occupied slot", async () => {
      const mockSlot = {
        id: slotId,
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: "[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: "session",
        status: "occupied",
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getSlotById and release
      (mockDb as { execute: jest.Mock }).execute
        .mockResolvedValueOnce({ rows: [mockSlot] }) // getSlotById
        .mockResolvedValueOnce({
          rows: [{ ...mockSlot, status: "cancelled" }],
        }); // release

      const result = await service.releaseSlot(slotId);

      expect(result.status).toBe(SlotStatus.CANCELLED);
    });

    it("should throw error when slot not found", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [],
      });

      await expect(service.releaseSlot(slotId)).rejects.toThrow(
        CalendarNotFoundException,
      );
    });

    it("should throw error when slot is already cancelled", async () => {
      const cancelledSlot = {
        id: slotId,
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: "[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: "session",
        status: "cancelled",
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [cancelledSlot],
      });

      await expect(service.releaseSlot(slotId)).rejects.toThrow(
        CalendarException,
      );
    });
  });

  describe("getOccupiedSlots", () => {
    const queryDto: QuerySlotDto = {
      resourceType: ResourceType.MENTOR,
      resourceId: "mentor-id-123",
      dateFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      dateTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it("should return list of occupied slots", async () => {
      const mockSlots = [
        {
          id: "slot-1",
          resource_type: "mentor",
          resource_id: "mentor-id-123",
          time_range: "[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)",
          duration_minutes: 60,
          session_id: "session-1",
          slot_type: "session",
          status: "occupied",
          reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "slot-2",
          resource_type: "mentor",
          resource_id: "mentor-id-123",
          time_range: "[2025-11-11 14:00:00+00, 2025-11-11 15:00:00+00)",
          duration_minutes: 60,
          session_id: "session-2",
          slot_type: "session",
          status: "occupied",
          reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: mockSlots,
      });

      const result = await service.getOccupiedSlots(queryDto);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("slot-1");
    });

    it("should throw error when date range is too large", async () => {
      const invalidDto: QuerySlotDto = {
        resourceType: ResourceType.MENTOR,
        resourceId: "mentor-id-123",
        dateFrom: new Date().toISOString(),
        dateTo: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days
      };

      await expect(service.getOccupiedSlots(invalidDto)).rejects.toThrow(
        CalendarException,
      );
    });
  });

  describe("blockTimeSlot", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    it("should create blocked slot", async () => {
      const mockSlot = {
        id: "slot-id-123",
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: `[${futureDate.toISOString()}, ${new Date(futureDate.getTime() + 60 * 60000).toISOString()})`,
        duration_minutes: 60,
        session_id: null,
        slot_type: "blocked",
        status: "occupied",
        reason: "Mentor on vacation",
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute
        .mockResolvedValueOnce({ rows: [{ count: "0" }] }) // isSlotAvailable
        .mockResolvedValueOnce({ rows: [mockSlot] }); // create

      const result = await service.blockTimeSlot(
        ResourceType.MENTOR,
        "mentor-id-123",
        futureDate,
        60,
        "Mentor on vacation",
      );

      expect(result.slotType).toBe(SlotType.BLOCKED);
      expect(result.reason).toBe("Mentor on vacation");
    });
  });

  describe("rescheduleSlot", () => {
    const oldSlotId = "old-slot-id";
    const newStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const newDuration = 90;

    it("should reschedule slot successfully", async () => {
      const oldSlot = {
        id: oldSlotId,
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: "[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: "session",
        status: "occupied",
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const newSlot = {
        ...oldSlot,
        id: "new-slot-id",
        time_range: `[${newStartTime.toISOString()}, ${new Date(newStartTime.getTime() + newDuration * 60000).toISOString()})`,
        duration_minutes: newDuration,
      };

      // Mock getSlotById, isSlotAvailable, and transaction
      (mockDb as { execute: jest.Mock }).execute
        .mockResolvedValueOnce({ rows: [oldSlot] }) // getSlotById
        .mockResolvedValueOnce({ rows: [{ count: "0" }] }); // isSlotAvailable

      (mockDb as { transaction: jest.Mock }).transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            execute: jest
              .fn()
              .mockResolvedValueOnce({ rows: [] }) // release old
              .mockResolvedValueOnce({ rows: [newSlot] }), // create new
          };
          return await callback(mockTx);
        },
      );

      const result = await service.rescheduleSlot(
        oldSlotId,
        newStartTime,
        newDuration,
      );

      expect(result).toBeDefined();
      expect(result.durationMinutes).toBe(newDuration);
    });

    it("should throw error when new slot conflicts", async () => {
      const oldSlot = {
        id: oldSlotId,
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: "[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: "session",
        status: "occupied",
        reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockDb as { execute: jest.Mock }).execute
        .mockResolvedValueOnce({ rows: [oldSlot] }) // getSlotById
        .mockResolvedValueOnce({ rows: [{ count: "1" }] }); // isSlotAvailable - conflict

      await expect(
        service.rescheduleSlot(oldSlotId, newStartTime, newDuration),
      ).rejects.toThrow(CalendarConflictException);
    });
  });

  describe("getSlotBySessionId", () => {
    it("should return slot when found", async () => {
      const mockSlot = {
        id: "slot-id-123",
        resource_type: "mentor",
        resource_id: "mentor-id-123",
        time_range: "[2025-11-10 14:00:00+00, 2025-11-10 15:00:00+00)",
        duration_minutes: 60,
        session_id: "session-id-123",
        slot_type: "session",
        status: "occupied",
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

    it("should return null when not found", async () => {
      (mockDb as { execute: jest.Mock }).execute.mockResolvedValue({
        rows: [],
      });

      const result = await service.getSlotBySessionId("non-existent");

      expect(result).toBeNull();
    });
  });
});
