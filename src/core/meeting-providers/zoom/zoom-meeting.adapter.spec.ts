import { Test, TestingModule } from "@nestjs/testing";
import { ZoomMeetingAdapter } from "./zoom-meeting.adapter";
import { ZoomMeetingClient } from "./zoom-meeting.client";
import {
  MeetingCreationFailedException,
  MeetingUpdateFailedException,
  MeetingCancellationFailedException,
  MeetingNotFoundException,
} from "../exceptions/meeting-provider.exception";

describe("ZoomMeetingAdapter", () => {
  let adapter: ZoomMeetingAdapter;
  let client: ZoomMeetingClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZoomMeetingAdapter,
        {
          provide: ZoomMeetingClient,
          useValue: {
            createMeeting: jest.fn(),
            updateMeeting: jest.fn(),
            deleteMeeting: jest.fn(),
            getMeetingInfo: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<ZoomMeetingAdapter>(ZoomMeetingAdapter);
    client = module.get<ZoomMeetingClient>(ZoomMeetingClient);
  });

  describe("createMeeting", () => {
    it("should throw MeetingCreationFailedException with not implemented message", async () => {
      const input = {
        topic: "Test Meeting",
        startTime: new Date("2025-11-10T14:00:00Z"),
        duration: 60,
        autoRecord: true,
        enableWaitingRoom: true,
      };

      await expect(adapter.createMeeting(input)).rejects.toThrow(
        MeetingCreationFailedException,
      );

      await expect(adapter.createMeeting(input)).rejects.toThrow(
        "Zoom integration not yet implemented",
      );
    });

    it("should handle different input parameters", async () => {
      const input = {
        topic: "Another Test Meeting",
        startTime: new Date("2025-12-01T10:00:00Z"),
        duration: 30,
        enableWaitingRoom: false,
      };

      await expect(adapter.createMeeting(input)).rejects.toThrow(
        MeetingCreationFailedException,
      );
    });
  });

  describe("updateMeeting", () => {
    it("should throw MeetingUpdateFailedException with not implemented message", async () => {
      const meetingId = "zoom_meeting_123";
      const input = {
        topic: "Updated Meeting",
        autoRecord: false,
      };

      await expect(adapter.updateMeeting(meetingId, input)).rejects.toThrow(
        MeetingUpdateFailedException,
      );

      await expect(adapter.updateMeeting(meetingId, input)).rejects.toThrow(
        "Zoom integration not yet implemented",
      );
    });

    it("should include meetingId in exception", async () => {
      const meetingId = "zoom_meeting_123";
      const input = {
        topic: "Updated Meeting",
      };

      try {
        await adapter.updateMeeting(meetingId, input);
      } catch (error) {
        expect((error as Error).message).toContain(meetingId);
      }
    });
  });

  describe("cancelMeeting", () => {
    it("should throw MeetingCancellationFailedException with not implemented message", async () => {
      const meetingId = "zoom_meeting_123";

      await expect(adapter.cancelMeeting(meetingId)).rejects.toThrow(
        MeetingCancellationFailedException,
      );

      await expect(adapter.cancelMeeting(meetingId)).rejects.toThrow(
        "Zoom integration not yet implemented",
      );
    });

    it("should include meetingId in exception", async () => {
      const meetingId = "zoom_meeting_123";

      try {
        await adapter.cancelMeeting(meetingId);
      } catch (error) {
        expect((error as Error).message).toContain(meetingId);
      }
    });
  });

  describe("getMeetingInfo", () => {
    it("should throw MeetingNotFoundException with not implemented message", async () => {
      const meetingId = "zoom_meeting_123";

      await expect(adapter.getMeetingInfo(meetingId)).rejects.toThrow(
        MeetingNotFoundException,
      );
    });

    it("should include meetingId in exception", async () => {
      const meetingId = "zoom_meeting_123";

      try {
        await adapter.getMeetingInfo(meetingId);
      } catch (error) {
        expect((error as Error).message).toContain(meetingId);
      }
    });
  });

  describe("integration behavior", () => {
    it("should be injectable as a provider", () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(ZoomMeetingAdapter);
    });

    it("should have ZoomMeetingClient as dependency", () => {
      expect(client).toBeDefined();
    });

    it("should implement IMeetingProvider interface methods", () => {
      expect(typeof adapter.createMeeting).toBe("function");
      expect(typeof adapter.updateMeeting).toBe("function");
      expect(typeof adapter.cancelMeeting).toBe("function");
      expect(typeof adapter.getMeetingInfo).toBe("function");
    });
  });
});
