import { Test, TestingModule } from "@nestjs/testing";
import { FeishuMeetingAdapter } from "./feishu-meeting.adapter";
import { FeishuMeetingClient } from "./feishu-meeting.client";
import { MeetingProviderType } from "../interfaces/meeting-provider.interface";
import {
  MeetingCreationFailedException,
  MeetingUpdateFailedException,
  MeetingCancellationFailedException,
  MeetingNotFoundException,
} from "../exceptions/meeting-provider.exception";

describe("FeishuMeetingAdapter", () => {
  let adapter: FeishuMeetingAdapter;
  let client: FeishuMeetingClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeishuMeetingAdapter,
        {
          provide: FeishuMeetingClient,
          useValue: {
            applyReservation: jest.fn(),
            updateReservation: jest.fn(),
            deleteReservation: jest.fn(),
            getReservationInfo: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<FeishuMeetingAdapter>(FeishuMeetingAdapter);
    client = module.get<FeishuMeetingClient>(FeishuMeetingClient);
  });

  describe("createMeeting", () => {
    it("should create a meeting successfully", async () => {
      const input = {
        topic: "Test Meeting",
        startTime: new Date("2025-11-10T14:00:00Z"),
        duration: 60,
        autoRecord: true,
        participantJoinEarly: true,
      };

      const mockResponse = {
        reserve: {
          id: "reserve_123",
          meeting_no: "123456789",
          url: "https://vc.feishu.cn/j/123456789",
          live_link: "",
          end_time: "1731250800",
        },
      };

      jest.spyOn(client, "applyReservation").mockResolvedValue(mockResponse);

      const result = await adapter.createMeeting(input);

      expect(result).toEqual({
        provider: MeetingProviderType.FEISHU,
        meetingId: "reserve_123",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        hostJoinUrl: null,
        startTime: input.startTime,
        duration: 60,
      });

      expect(client.applyReservation).toHaveBeenCalledWith({
        end_time: "1731250800",
        meeting_settings: {
          topic: "Test Meeting",
          auto_record: true,
          open_lobby: false,
          allow_attendees_start: true,
        },
      });
    });

    it("should throw error when meeting creation fails", async () => {
      const input = {
        topic: "Test Meeting",
        startTime: new Date("2025-11-10T14:00:00Z"),
        duration: 60,
      };

      jest
        .spyOn(client, "applyReservation")
        .mockRejectedValue(new Error("API error"));

      await expect(adapter.createMeeting(input)).rejects.toThrow(
        MeetingCreationFailedException,
      );
    });
  });

  describe("updateMeeting", () => {
    it("should update a meeting successfully", async () => {
      const mockReserveInfo = {
        reserve: {
          id: "reserve_123",
          meeting_no: "123456789",
          url: "https://vc.feishu.cn/j/123456789",
          live_link: "",
          end_time: "1731250800",
          topic: "Old Topic",
          meeting_start_time: "2025-11-10T14:00:00Z",
          meeting_duration: 60,
          owner: {
            id: "ou_xxx",
            user_type: 1,
          },
        },
      };

      jest
        .spyOn(client, "getReservationInfo")
        .mockResolvedValue(mockReserveInfo);
      jest.spyOn(client, "updateReservation").mockResolvedValue(undefined);

      const result = await adapter.updateMeeting("reserve_123", {
        topic: "New Topic",
        autoRecord: true,
      });

      expect(result).toBe(true);
      expect(client.updateReservation).toHaveBeenCalled();
    });

    it("should throw error when meeting update fails", async () => {
      jest
        .spyOn(client, "updateReservation")
        .mockRejectedValue(new Error("API error"));

      await expect(
        adapter.updateMeeting("reserve_123", { topic: "New Topic" }),
      ).rejects.toThrow(MeetingUpdateFailedException);
    });
  });

  describe("cancelMeeting", () => {
    it("should cancel a meeting successfully", async () => {
      jest.spyOn(client, "deleteReservation").mockResolvedValue(undefined);

      const result = await adapter.cancelMeeting("reserve_123");

      expect(result).toBe(true);
      expect(client.deleteReservation).toHaveBeenCalledWith("reserve_123");
    });

    it("should throw error when meeting cancellation fails", async () => {
      jest
        .spyOn(client, "deleteReservation")
        .mockRejectedValue(new Error("API error"));

      await expect(adapter.cancelMeeting("reserve_123")).rejects.toThrow(
        MeetingCancellationFailedException,
      );
    });
  });

  describe("getMeetingInfo", () => {
    it("should get meeting info successfully", async () => {
      const mockReserveInfo = {
        reserve: {
          id: "reserve_123",
          meeting_no: "123456789",
          url: "https://vc.feishu.cn/j/123456789",
          live_link: "",
          end_time: "1731250800",
          topic: "Test Meeting",
          meeting_start_time: "2025-11-10T14:00:00Z",
          meeting_duration: 60,
          owner: {
            id: "ou_xxx",
            user_type: 1,
          },
        },
      };

      jest
        .spyOn(client, "getReservationInfo")
        .mockResolvedValue(mockReserveInfo);

      const result = await adapter.getMeetingInfo("reserve_123");

      expect(result).toEqual({
        provider: MeetingProviderType.FEISHU,
        meetingId: "reserve_123",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        hostJoinUrl: null,
        startTime: new Date("2025-11-10T14:00:00Z"),
        duration: 60,
      });
    });

    it("should throw error when meeting not found", async () => {
      jest
        .spyOn(client, "getReservationInfo")
        .mockRejectedValue(new Error("Not found"));

      await expect(adapter.getMeetingInfo("reserve_123")).rejects.toThrow(
        MeetingNotFoundException,
      );
    });
  });
});
