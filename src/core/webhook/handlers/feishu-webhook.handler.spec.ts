import { FeishuWebhookHandler } from "./feishu-webhook.handler";
import { FeishuEventExtractor } from "../extractors/feishu-event-extractor";
import { IFeishuWebhookRequest } from "../dto/webhook-event.dto";

describe("FeishuWebhookHandler", () => {
  let handler: FeishuWebhookHandler;
  let mockExtractor: jest.Mocked<Partial<FeishuEventExtractor>>;
  let mockEventEmitter: any;

  beforeEach(() => {
    // Create mock objects
    mockExtractor = {
      extractStandardEvent: jest.fn(),
      extractFullEvent: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    // Manually create handler with mocks
    handler = new FeishuWebhookHandler(
      mockExtractor as any,
      mockEventEmitter as any,
    );
  });

  describe("handle", () => {
    it("should extract standard event and emit to event bus", async () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_123",
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1234567890",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_123",
            meeting_no: "123456789",
            topic: "Test Meeting",
            start_time: "1609459200",
            end_time: "1609462800",
          },
          operator: {
            id: {
              user_id: "operator_123",
            },
            user_role: 1,
          },
        },
      };

      const standardEvent: any = {
        meetingNo: "123456789",
        meetingId: "meeting_123",
        eventType: "vc.meeting.meeting_ended_v1",
        provider: "feishu" as const,
        eventData: payload,
        occurredAt: new Date(),
        operatorId: "operator_123",
      };

      (mockExtractor.extractStandardEvent as jest.Mock).mockReturnValue(
        standardEvent,
      );

      await handler.handle(payload);

      expect(mockExtractor.extractStandardEvent).toHaveBeenCalledWith(payload);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "webhook.feishu.event",
        standardEvent,
      );
    });

    it("should handle meeting.started event", async () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_started_123",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1234567890",
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
        },
      };

      const standardEvent: any = {
        meetingNo: "987654321",
        meetingId: "meeting_456",
        eventType: "vc.meeting.meeting_started_v1",
        provider: "feishu" as const,
        eventData: payload,
        occurredAt: new Date(),
      };

      (mockExtractor.extractStandardEvent as jest.Mock).mockReturnValue(
        standardEvent,
      );

      await handler.handle(payload);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "webhook.feishu.event",
        standardEvent,
      );
    });

    it("should handle recording.ready event", async () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_recording_123",
          event_type: "vc.meeting.recording_ready_v1",
          create_time: "1234567890",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.recording_ready_v1",
          meeting: {
            id: "meeting_789",
            meeting_no: "555555555",
          },
          recording: {
            id: "recording_123",
            url: "https://example.com/recording",
          },
        },
      };

      const standardEvent: any = {
        meetingNo: "555555555",
        meetingId: "meeting_789",
        eventType: "vc.meeting.recording_ready_v1",
        provider: "feishu" as const,
        eventData: payload,
        occurredAt: new Date(),
      };

      (mockExtractor.extractStandardEvent as jest.Mock).mockReturnValue(
        standardEvent,
      );

      await handler.handle(payload);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "webhook.feishu.event",
        standardEvent,
      );
    });

    it("should handle join.meeting event with operator", async () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_join_123",
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1234567890",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.join_meeting_v1",
          meeting: {
            id: "meeting_join_123",
            meeting_no: "111111111",
          },
          operator: {
            id: {
              user_id: "user_join_123",
            },
            user_role: 2,
          },
        },
      };

      const standardEvent: any = {
        meetingNo: "111111111",
        meetingId: "meeting_join_123",
        eventType: "vc.meeting.join_meeting_v1",
        provider: "feishu" as const,
        eventData: payload,
        occurredAt: new Date(),
        operatorId: "user_join_123",
      };

      (mockExtractor.extractStandardEvent as jest.Mock).mockReturnValue(
        standardEvent,
      );

      await handler.handle(payload);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "webhook.feishu.event",
        standardEvent,
      );
    });

    it("should handle leave.meeting event", async () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_leave_123",
          event_type: "vc.meeting.leave_meeting_v1",
          create_time: "1234567890",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.leave_meeting_v1",
          meeting: {
            id: "meeting_leave",
            meeting_no: "222222222",
          },
          operator: {
            id: {
              user_id: "user_leave_456",
            },
          },
        },
      };

      const standardEvent: any = {
        meetingNo: "222222222",
        meetingId: "meeting_leave",
        eventType: "vc.meeting.leave_meeting_v1",
        provider: "feishu" as const,
        eventData: payload,
        occurredAt: new Date(),
        operatorId: "user_leave_456",
      };

      (mockExtractor.extractStandardEvent as jest.Mock).mockReturnValue(
        standardEvent,
      );

      await handler.handle(payload);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "webhook.feishu.event",
        standardEvent,
      );
    });

    it("should extract and emit events in correct order", async () => {
      const payload: IFeishuWebhookRequest = {
        header: {
          event_id: "event_order_test",
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1234567890",
          token: "test_token",
          app_id: "app_123",
          tenant_key: "tenant_123",
        },
        event: {
          type: "vc.meeting.meeting_started_v1",
          meeting: {
            id: "meeting_order",
            meeting_no: "444444444",
          },
        },
      };

      const standardEvent: any = {
        meetingNo: "444444444",
        meetingId: "meeting_order",
        eventType: "vc.meeting.meeting_started_v1",
        provider: "feishu" as const,
        eventData: payload,
        occurredAt: new Date(),
      };

      const callOrder: string[] = [];

      (mockExtractor.extractStandardEvent as jest.Mock).mockImplementation(
        (): any => {
          callOrder.push("extract");
          return standardEvent;
        },
      );

      (mockEventEmitter.emit as jest.Mock).mockImplementation((): void => {
        callOrder.push("emit");
      });

      await handler.handle(payload);

      // Verify extraction happens before emit
      expect(callOrder).toEqual(["extract", "emit"]);
    });
  });
});
