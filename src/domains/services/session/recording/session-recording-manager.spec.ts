import { Test, TestingModule } from "@nestjs/testing";
import { SessionRecordingManager } from "./session-recording-manager";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  SessionNotFoundException,
} from "../exceptions/session.exception";
import { IRecording } from "../interfaces/session.interface";

describe("SessionRecordingManager", () => {
  let service: SessionRecordingManager;
  let mockDb: any;

  // Mock database connection
  const createMockDb = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    }),
    set: jest.fn().mockReturnThis(),
  });

  const mockSession = {
    id: "00000000-0000-0000-0000-000000000001",
    studentId: "00000000-0000-0000-0000-000000000002",
    mentorId: "00000000-0000-0000-0000-000000000003",
    recordings: [],
    deletedAt: null,
  };

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionRecordingManager,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SessionRecordingManager>(SessionRecordingManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("appendRecording", () => {
    it("should append new recording to empty recordings array", async () => {
      const recordingData: Omit<IRecording, "sequence"> = {
        recordingId: "rec_001",
        recordingUrl: "https://example.com/rec_001",
        transcriptUrl: null,
        duration: 3600,
        startedAt: new Date("2025-11-06T10:00:00Z"),
        endedAt: new Date("2025-11-06T11:00:00Z"),
      };

      mockDb.limit.mockResolvedValueOnce([mockSession]);

      const result = await service.appendRecording(
        mockSession.id,
        recordingData,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...recordingData,
        sequence: 1,
      });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should append recording with correct sequence to existing recordings", async () => {
      const existingRecordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date("2025-11-06T10:00:00Z"),
          endedAt: new Date("2025-11-06T11:00:00Z"),
        },
        {
          recordingId: "rec_002",
          recordingUrl: "https://example.com/rec_002",
          transcriptUrl: null,
          duration: 3600,
          sequence: 2,
          startedAt: new Date("2025-11-06T11:00:00Z"),
          endedAt: new Date("2025-11-06T12:00:00Z"),
        },
      ];

      const newRecordingData: Omit<IRecording, "sequence"> = {
        recordingId: "rec_003",
        recordingUrl: "https://example.com/rec_003",
        transcriptUrl: null,
        duration: 1800,
        startedAt: new Date("2025-11-06T12:00:00Z"),
        endedAt: new Date("2025-11-06T12:30:00Z"),
      };

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings: existingRecordings,
        },
      ]);

      const result = await service.appendRecording(
        mockSession.id,
        newRecordingData,
      );

      expect(result).toHaveLength(3);
      expect(result[2]).toMatchObject({
        ...newRecordingData,
        sequence: 3,
      });
    });

    it("should throw SessionNotFoundException when session not found", async () => {
      const recordingData: Omit<IRecording, "sequence"> = {
        recordingId: "rec_001",
        recordingUrl: "https://example.com/rec_001",
        transcriptUrl: null,
        duration: 3600,
        startedAt: new Date(),
        endedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.appendRecording("non-existent-id", recordingData),
      ).rejects.toThrow(SessionNotFoundException);
    });
  });

  describe("updateRecordingTranscript", () => {
    it("should update transcript URL for existing recording", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date("2025-11-06T10:00:00Z"),
          endedAt: new Date("2025-11-06T11:00:00Z"),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const transcriptUrl = "https://example.com/transcript_001";
      const result = await service.updateRecordingTranscript(
        mockSession.id,
        "rec_001",
        transcriptUrl,
      );

      expect(result[0].transcriptUrl).toBe(transcriptUrl);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should return unchanged recordings when recording not found", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const result = await service.updateRecordingTranscript(
        mockSession.id,
        "non-existent-rec",
        "https://example.com/transcript",
      );

      expect(result).toEqual(recordings);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw SessionNotFoundException when session not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.updateRecordingTranscript(
          "non-existent-id",
          "rec_001",
          "https://example.com/transcript",
        ),
      ).rejects.toThrow(SessionNotFoundException);
    });
  });

  describe("isAllTranscriptsFetched", () => {
    it("should return true when all recordings have transcript URLs", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: "https://example.com/transcript_001",
          duration: 3600,
          sequence: 1,
          startedAt: new Date(),
          endedAt: new Date(),
        },
        {
          recordingId: "rec_002",
          recordingUrl: "https://example.com/rec_002",
          transcriptUrl: "https://example.com/transcript_002",
          duration: 3600,
          sequence: 2,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const result = await service.isAllTranscriptsFetched(mockSession.id);

      expect(result).toBe(true);
    });

    it("should return false when some recordings are missing transcript URLs", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: "https://example.com/transcript_001",
          duration: 3600,
          sequence: 1,
          startedAt: new Date(),
          endedAt: new Date(),
        },
        {
          recordingId: "rec_002",
          recordingUrl: "https://example.com/rec_002",
          transcriptUrl: null,
          duration: 3600,
          sequence: 2,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const result = await service.isAllTranscriptsFetched(mockSession.id);

      expect(result).toBe(false);
    });

    it("should return false when there are no recordings", async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings: [],
        },
      ]);

      const result = await service.isAllTranscriptsFetched(mockSession.id);

      expect(result).toBe(false);
    });
  });

  describe("getAllRecordings", () => {
    it("should return all recordings for a session", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date(),
          endedAt: new Date(),
        },
        {
          recordingId: "rec_002",
          recordingUrl: "https://example.com/rec_002",
          transcriptUrl: null,
          duration: 3600,
          sequence: 2,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const result = await service.getAllRecordings(mockSession.id);

      expect(result).toEqual(recordings);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no recordings exist", async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings: [],
        },
      ]);

      const result = await service.getAllRecordings(mockSession.id);

      expect(result).toEqual([]);
    });

    it("should throw SessionNotFoundException when session not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getAllRecordings("non-existent-id"),
      ).rejects.toThrow(SessionNotFoundException);
    });
  });

  describe("getRecordingBySequence", () => {
    it("should return recording with matching sequence", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date(),
          endedAt: new Date(),
        },
        {
          recordingId: "rec_002",
          recordingUrl: "https://example.com/rec_002",
          transcriptUrl: null,
          duration: 3600,
          sequence: 2,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const result = await service.getRecordingBySequence(mockSession.id, 2);

      expect(result).toMatchObject({
        recordingId: "rec_002",
        sequence: 2,
      });
    });

    it("should return null when sequence not found", async () => {
      const recordings: IRecording[] = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      mockDb.limit.mockResolvedValueOnce([
        {
          ...mockSession,
          recordings,
        },
      ]);

      const result = await service.getRecordingBySequence(mockSession.id, 99);

      expect(result).toBeNull();
    });
  });
});
