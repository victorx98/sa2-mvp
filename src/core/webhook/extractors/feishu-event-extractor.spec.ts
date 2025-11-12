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

  describe("extract", () => {
    it("should extract all fields from a valid Feishu join_meeting event", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "5e3702a84e847582be8db7fb73283c02",
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1608725989000",
          token: "rvaYgkND1GOiu5MM0E1rncYC6PLtF7JV",
          app_id: "cli_9f5343c580712544",
          tenant_key: "2ca1d211f64f6438",
        },
        event: {
          meeting: {
            id: "6911188411934433028",
            topic: "my meeting",
            meeting_no: "235812466",
            start_time: "1608883322",
            end_time: "1608883899",
            host_user: {
              id: {
                union_id: "on_8ed6aa67826108097d9ee143816345",
                user_id: "e33ggbyz",
                open_id: "ou_84aad35d084aa403a838cf73ee18467",
              },
              user_role: 1,
              user_type: 1,
            },
            owner: {
              id: {
                union_id: "on_8ed6aa67826108097d9ee143816345",
                user_id: "e33ggbyz",
                open_id: "ou_84aad35d084aa403a838cf73ee18467",
              },
              user_role: 1,
              user_type: 1,
            },
          },
          operator: {
            id: {
              union_id: "on_8ed6aa67826108097d9ee143816345",
              user_id: "e33ggbyz",
              open_id: "ou_84aad35d084aa403a838cf73ee18467",
            },
            user_role: 1,
            user_type: 1,
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      // Assertions for extracted data
      expect(extracted.meetingId).toBe("6911188411934433028");
      expect(extracted.meetingNo).toBe("235812466");
      expect(extracted.eventId).toBe("5e3702a84e847582be8db7fb73283c02");
      expect(extracted.eventType).toBe("vc.meeting.join_meeting_v1");
      expect(extracted.provider).toBe("feishu");
      expect(extracted.operatorId).toBe("e33ggbyz"); // user_id is prioritized
      expect(extracted.operatorRole).toBe(1); // host
      expect(extracted.meetingTopic).toBe("my meeting");
      expect(extracted.meetingStartTime).toEqual(
        new Date(1608883322 * 1000)
      );
      expect(extracted.meetingEndTime).toEqual(new Date(1608883899 * 1000));
      expect(extracted.occurredAt).toEqual(new Date(1608725989 * 1000)); // create_time in milliseconds
      expect(extracted.eventData).toBeDefined();
    });

    it("should handle missing operator id gracefully", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "event_123",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1608725989000",
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_123",
            topic: "test meeting",
            meeting_no: "123456789",
            start_time: "1608883322",
            end_time: "1608883899",
          },
          operator: {
            // No id provided
            user_role: 1,
            user_type: 1,
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.operatorId).toBeNull();
      expect(extracted.operatorRole).toBe(1);
    });

    it("should fallback to open_id when user_id is not available", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "event_456",
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1608725989000",
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_456",
            meeting_no: "987654321",
            start_time: "1608883322",
            end_time: "1608883899",
          },
          operator: {
            id: {
              open_id: "ou_84aad35d084aa403a838cf73ee18467",
              // user_id not provided
            },
            user_role: 2,
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.operatorId).toBe("ou_84aad35d084aa403a838cf73ee18467");
      expect(extracted.operatorRole).toBe(2); // participant
    });

    it("should handle recording event with recording_id and url", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "recording_event_789",
          event_type: "vc.meeting.recording_ready_v1",
          create_time: "1608725989000",
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_789",
            meeting_no: "555555555",
          },
          recording: {
            id: "rec_001",
            url: "https://example.com/recording/001",
            duration: 3600,
            start_time: "2021-01-01T10:00:00Z",
            end_time: "2021-01-01T11:00:00Z",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.recordingId).toBe("rec_001");
      expect(extracted.recordingUrl).toBe("https://example.com/recording/001");
    });

    it("should handle missing meeting_no (not all events have it)", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "event_without_meeting_no",
          event_type: "vc.meeting.share_started_v1",
          create_time: "1608725989000",
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_with_id_only",
            // meeting_no not provided
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.meetingId).toBe("meeting_with_id_only");
      expect(extracted.meetingNo).toBeNull();
    });

    it("should parse create_time correctly when in milliseconds format", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "event_time_test",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1608725989000", // milliseconds
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_time_test",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      // The service should recognize this as milliseconds and convert properly
      expect(extracted.occurredAt).toBeDefined();
      expect(extracted.occurredAt instanceof Date).toBe(true);
    });

    it("should handle invalid time values gracefully", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "event_invalid_time",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "invalid_timestamp", // Invalid
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_invalid_time",
            start_time: "invalid", // Invalid
            end_time: "also_invalid", // Invalid
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      // Should handle invalid times by returning null or current time
      expect(extracted.meetingStartTime).toBeNull();
      expect(extracted.meetingEndTime).toBeNull();
      expect(extracted.occurredAt).toBeDefined();
    });

    it("should preserve complete raw event data in eventData field", () => {
      const rawEvent: IFeishuWebhookRequest = {
        schema: "2.0",
        header: {
          event_id: "event_data_preservation",
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1608725989000",
          token: "token",
          app_id: "app_id",
          tenant_key: "tenant_key",
        },
        event: {
          meeting: {
            id: "meeting_data_test",
            meeting_no: "111111111",
            custom_field: "custom_value", // Non-standard field
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      // eventData should contain the raw event
      expect(extracted.eventData).toBeDefined();
      expect(extracted.eventData.header).toBeDefined();
      expect(extracted.eventData.event).toBeDefined();
    });
  });

  describe("extract - edge cases for meeting_no", () => {
    it("should extract meeting_no from various formats", () => {
      const testCases = [
        { input: "123456789", expected: "123456789" },
        { input: 123456789, expected: "123456789" },
        { input: null, expected: null },
        { input: undefined, expected: null },
      ];

      for (const testCase of testCases) {
        const rawEvent: IFeishuWebhookRequest = {
          schema: "2.0",
          header: {
            event_id: "test",
            event_type: "vc.meeting.join_meeting_v1",
            create_time: "1608725989000",
            token: "token",
            app_id: "app_id",
            tenant_key: "tenant_key",
          },
          event: {
            meeting: {
              id: "meeting_test",
              meeting_no: testCase.input as any,
            },
          },
        };

        const extracted = extractor.extract(rawEvent);
        expect(extracted.meetingNo).toBe(testCase.expected);
      }
    });
  });
});

