import { Test, TestingModule } from "@nestjs/testing";
import { FeishuEventExtractor } from "./feishu-event-extractor";
import { IFeishuWebhookRequest } from "../dto/webhook-event.dto";

describe("FeishuEventExtractor", () => {
  let extractor: FeishuEventExtractor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeishuEventExtractor],
    }).compile();

    extractor = module.get<FeishuEventExtractor>(FeishuEventExtractor);
  });

  describe("extractStandardEvent", () => {
    it("should extract minimal required fields", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_123",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_123",
            meeting_no: "123456789",
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.meetingNo).toBe("123456789");
      expect(result.meetingId).toBe("meeting_123");
      expect(result.eventType).toBe("vc.meeting.meeting_ended_v1");
      expect(result.provider).toBe("feishu");
      expect(result.eventData).toEqual(payload);
      expect(result.operatorId).toBeUndefined();
    });

    it("should extract operator ID when present", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_456",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_started_v1",
          meeting: {
            id: "meeting_456",
            meeting_no: "987654321",
          },
          operator: {
            id: {
              user_id: "user_123",
            },
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.operatorId).toBe("user_123");
    });

    it("should use open_id when user_id is not available", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_789",
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.join_meeting_v1",
          meeting: {
            id: "meeting_789",
            meeting_no: "555555555",
          },
          operator: {
            id: {
              open_id: "open_id_456",
            },
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.operatorId).toBe("open_id_456");
    });

    it("should handle missing meeting_no", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_101",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_101",
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.meetingNo).toBe("");
    });

    it("should parse occurredAt timestamp correctly", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_time",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000", // milliseconds
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_time",
            meeting_no: "111111111",
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.occurredAt).toEqual(new Date(1609459200000));
    });
  });

  describe("extractFullEvent", () => {
    it("should extract all available fields", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_full",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_full",
            meeting_no: "999999999",
            topic: "Full Meeting",
            start_time: "1609459200",
            end_time: "1609462800",
          },
          operator: {
            id: {
              user_id: "user_full",
            },
            user_role: 1,
          },
          recording: {
            id: "recording_full",
            url: "https://example.com/recording",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.meetingId).toBe("meeting_full");
      expect(result.meetingNo).toBe("999999999");
      expect(result.eventId).toBe("event_full");
      expect(result.eventType).toBe("vc.meeting.meeting_ended_v1");
      expect(result.provider).toBe("feishu");
      expect(result.operatorId).toBe("user_full");
      expect(result.operatorRole).toBe(1);
      expect(result.meetingTopic).toBe("Full Meeting");
      expect(result.meetingStartTime).toEqual(
        new Date("2021-01-01T00:00:00Z"),
      );
      expect(result.meetingEndTime).toEqual(new Date("2021-01-01T01:00:00Z"));
      expect(result.recordingId).toBe("recording_full");
      expect(result.recordingUrl).toBe("https://example.com/recording");
    });

    it("should handle missing recording fields", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_no_recording",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_started_v1",
          meeting: {
            id: "meeting_started",
            meeting_no: "888888888",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.recordingId).toBeNull();
      expect(result.recordingUrl).toBeNull();
    });

    it("should handle operator role correctly", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_role",
          event_type: "vc.meeting.leave_meeting_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.leave_meeting_v1",
          meeting: {
            id: "meeting_role",
            meeting_no: "777777777",
          },
          operator: {
            id: {
              user_id: "user_participant",
            },
            user_role: 2,
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.operatorRole).toBe(2);
    });

    it("should parse Unix seconds to Date correctly", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_unix",
          event_type: "vc.meeting.recording_ready_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.recording_ready_v1",
          meeting: {
            id: "meeting_unix",
            meeting_no: "666666666",
            start_time: "1609459200", // Unix seconds
            end_time: "1609462800",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.meetingStartTime).toEqual(
        new Date("2021-01-01T00:00:00Z"),
      );
      expect(result.meetingEndTime).toEqual(
        new Date("2021-01-01T01:00:00Z"),
      );
    });

    it("should handle invalid time formats gracefully", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_invalid",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_invalid",
            meeting_no: "555555555",
            start_time: "invalid_time",
            end_time: "also_invalid",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.meetingStartTime).toBeNull();
      expect(result.meetingEndTime).toBeNull();
    });

    it("should convert milliseconds timestamp when needed", () => {
      const millisecondsTimestamp = "1609459200000"; // > 10^10

      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_ms",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: millisecondsTimestamp,
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_ms",
            meeting_no: "444444444",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.occurredAt).toEqual(new Date(1609459200000));
    });

    it("should handle missing operator information", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_no_operator",
          event_type: "vc.meeting.recording_started_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.recording_started_v1",
          meeting: {
            id: "meeting_no_op",
            meeting_no: "333333333",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.operatorId).toBeNull();
      expect(result.operatorRole).toBeNull();
    });

    it("should store complete raw event data", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_raw",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_raw",
            meeting_no: "222222222",
          },
        },
      };

      const result = extractor.extractFullEvent(payload);

      expect(result.eventData).toEqual(payload);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty event object", () => {
      const payload: any = {
        header: {
          event_id: "event_empty",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {},
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.meetingId).toBe("");
      expect(result.meetingNo).toBe("");
    });

    it("should handle NaN create_time gracefully", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_nan",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "not_a_number",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_nan",
            meeting_no: "111111111",
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.occurredAt.getTime()).toBeGreaterThan(0);
    });

    it("should prioritize user_id over open_id", () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_priority",
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1609459200000",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.join_meeting_v1",
          meeting: {
            id: "meeting_priority",
            meeting_no: "999999999",
          },
          operator: {
            id: {
              user_id: "user_priority",
              open_id: "open_priority",
            },
          },
        },
      };

      const result = extractor.extractStandardEvent(payload);

      expect(result.operatorId).toBe("user_priority");
    });
  });
});

