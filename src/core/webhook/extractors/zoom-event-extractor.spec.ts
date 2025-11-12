import { Test, TestingModule } from "@nestjs/testing";
import { ZoomEventExtractor } from "./zoom-event-extractor";
import { IZoomWebhookRequest } from "../dto/webhook-event.dto";

describe("ZoomEventExtractor", () => {
  let extractor: ZoomEventExtractor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZoomEventExtractor],
    }).compile();

    extractor = module.get<ZoomEventExtractor>(ZoomEventExtractor);
  });

  describe("extract", () => {
    it("should extract all fields from a valid Zoom meeting.started event", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1608725989,
        payload: {
          object: {
            id: 123456789,
            uuid: "abc123def456",
            host_id: "host_user_123",
            topic: "Test Meeting",
            type: 2,
            start_time: "2021-01-01T10:00:00Z",
            end_time: "2021-01-01T11:00:00Z",
            duration: 60,
            timezone: "UTC",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      // Verify extracted data
      expect(extracted.meetingId).toBe("123456789");
      expect(extracted.eventId).toBe("123456789_1608725989"); // Combined from meeting_id and event_ts
      expect(extracted.eventType).toBe("meeting.started");
      expect(extracted.provider).toBe("zoom");
      expect(extracted.operatorId).toBe("host_user_123");
      expect(extracted.operatorRole).toBeNull(); // Zoom doesn't provide role in webhook
      expect(extracted.meetingTopic).toBe("Test Meeting");
      expect(extracted.meetingNo).toBeNull(); // Zoom doesn't have meeting_no
      expect(extracted.meetingStartTime).toEqual(
        new Date("2021-01-01T10:00:00Z")
      );
      expect(extracted.meetingEndTime).toEqual(
        new Date("2021-01-01T11:00:00Z")
      );
      expect(extracted.occurredAt).toEqual(new Date(1608725989 * 1000)); // event_ts in seconds
      expect(extracted.eventData).toBeDefined();
    });

    it("should extract from Zoom meeting.ended event", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.ended",
        event_ts: 1608729589,
        payload: {
          object: {
            id: 987654321,
            host_id: "host_user_456",
            topic: "Ended Meeting",
            end_time: "2021-01-01T11:00:00Z",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.meetingId).toBe("987654321");
      expect(extracted.eventType).toBe("meeting.ended");
      expect(extracted.eventId).toBe("987654321_1608729589");
    });

    it("should extract from Zoom participant_joined event", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.participant_joined",
        event_ts: 1608726000,
        payload: {
          object: {
            id: 111111111,
            participant: {
              user_id: "participant_user_123",
              user_name: "John Doe",
              join_time: "2021-01-01T10:05:00Z",
            },
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.eventType).toBe("meeting.participant_joined");
      expect(extracted.meetingId).toBe("111111111");
    });

    it("should handle missing host_id gracefully", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1608725989,
        payload: {
          object: {
            id: 222222222,
            topic: "Meeting without host",
            // host_id is missing
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.operatorId).toBeNull();
      expect(extracted.meetingId).toBe("222222222");
    });

    it("should generate unique event_id from meeting_id and event_ts", () => {
      const rawEvent1: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1000,
        payload: {
          object: {
            id: 123,
          },
        },
      };

      const rawEvent2: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 2000,
        payload: {
          object: {
            id: 123,
          },
        },
      };

      const extracted1 = extractor.extract(rawEvent1);
      const extracted2 = extractor.extract(rawEvent2);

      // Different timestamps should generate different event_ids
      expect(extracted1.eventId).toBe("123_1000");
      expect(extracted2.eventId).toBe("123_2000");
      expect(extracted1.eventId).not.toBe(extracted2.eventId);
    });

    it("should handle invalid start_time and end_time", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1608725989,
        payload: {
          object: {
            id: 333333333,
            start_time: "invalid-date",
            end_time: "also-invalid",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.meetingStartTime).toBeNull();
      expect(extracted.meetingEndTime).toBeNull();
    });

    it("should parse ISO 8601 datetime format correctly", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1608725989,
        payload: {
          object: {
            id: 444444444,
            start_time: "2021-12-23T14:30:00Z",
            end_time: "2021-12-23T15:30:00Z",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.meetingStartTime).toEqual(
        new Date("2021-12-23T14:30:00Z")
      );
      expect(extracted.meetingEndTime).toEqual(
        new Date("2021-12-23T15:30:00Z")
      );
    });

    it("should handle recording.completed event", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "recording.completed",
        event_ts: 1608729600,
        payload: {
          object: {
            id: 555555555,
            recording_files: [
              {
                id: "rec_file_001",
                download_url: "https://example.com/recording/001.mp4",
              },
            ],
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.eventType).toBe("recording.completed");
      expect(extracted.meetingId).toBe("555555555");
    });

    it("should handle missing event_ts and meeting_id for event_id generation", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        // event_ts missing
        payload: {
          object: {
            // id missing
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      // Should handle gracefully with empty string
      expect(extracted.eventId).toBe("");
      expect(extracted.meetingId).toBe("");
    });

    it("should preserve complete raw event data in eventData field", () => {
      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1608725989,
        payload: {
          object: {
            id: 666666666,
            custom_field: "custom_value",
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.eventData).toBeDefined();
      expect(extracted.eventData.payload).toBeDefined();
      expect(extracted.eventData.event).toBe("meeting.started");
    });

    it("should convert Unix timestamp (seconds) to Date correctly", () => {
      const unixTimestampInSeconds = 1608725989;
      const expectedDate = new Date(unixTimestampInSeconds * 1000);

      const rawEvent: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: unixTimestampInSeconds,
        payload: {
          object: {
            id: 777777777,
          },
        },
      };

      const extracted = extractor.extract(rawEvent);

      expect(extracted.occurredAt).toEqual(expectedDate);
    });

    it("should handle various Zoom event types", () => {
      const eventTypes = [
        "meeting.started",
        "meeting.ended",
        "meeting.participant_joined",
        "meeting.participant_left",
        "recording.completed",
      ];

      for (const eventType of eventTypes) {
        const rawEvent: IZoomWebhookRequest = {
          event: eventType,
          event_ts: 1608725989,
          payload: {
            object: {
              id: 888888888,
            },
          },
        };

        const extracted = extractor.extract(rawEvent);

        expect(extracted.eventType).toBe(eventType);
        expect(extracted.provider).toBe("zoom");
      }
    });

    it("should handle numeric and string meeting IDs", () => {
      const rawEvent1: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1000,
        payload: {
          object: {
            id: 123456789, // numeric
          },
        },
      };

      const rawEvent2: IZoomWebhookRequest = {
        event: "meeting.started",
        event_ts: 1000,
        payload: {
          object: {
            id: "123456789", // string
          },
        },
      };

      const extracted1 = extractor.extract(rawEvent1);
      const extracted2 = extractor.extract(rawEvent2);

      // Both should be converted to strings
      expect(extracted1.meetingId).toBe("123456789");
      expect(extracted2.meetingId).toBe("123456789");
    });
  });
});

