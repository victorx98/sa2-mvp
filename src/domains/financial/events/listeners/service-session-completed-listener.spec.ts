import { Test, TestingModule } from "@nestjs/testing";
import { ServiceSessionCompletedListener } from "./service-session-completed-listener";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import {
  IServiceSessionCompletedEvent,
  SERVICE_SESSION_COMPLETED_EVENT,
} from "@shared/events/service-session-completed.event";

describe("ServiceSessionCompletedListener", () => {
  let listener: ServiceSessionCompletedListener;
  let mockMentorPayableService: jest.Mocked<MentorPayableService>;

  beforeEach(async () => {
    mockMentorPayableService = {
      isDuplicate: jest.fn(),
      getMentorPrice: jest.fn(),
      createPerSessionBilling: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceSessionCompletedListener,
        {
          provide: "IMentorPayableService",
          useValue: mockMentorPayableService,
        },
      ],
    }).compile();

    listener = module.get<ServiceSessionCompletedListener>(
      ServiceSessionCompletedListener,
    );
  });

  describe("handleServiceSessionCompletedEvent", () => {
    const validEvent: IServiceSessionCompletedEvent = {
      id: "event-123",
      type: SERVICE_SESSION_COMPLETED_EVENT,
      timestamp: Date.now(),
      payload: {
        sessionId: "session-123",
        studentId: "student-123",
        mentorId: "mentor-123",
        sessionTypeCode: "consultation",
        actualDurationHours: 2,
        durationHours: 2,
        allowBilling: true,
      },
    };

    const mockMentorPrice = {
      id: "price-123",
      mentorId: "mentor-123",
      sessionTypeCode: "consultation",
      price: "100",
      currency: "USD",
      status: "active",
    };

    it("should process valid event successfully", async () => {
      mockMentorPayableService.isDuplicate.mockResolvedValue(false);
      mockMentorPayableService.getMentorPrice.mockResolvedValue(
        mockMentorPrice as any,
      );
      mockMentorPayableService.createPerSessionBilling.mockResolvedValue();

      await listener.handleServiceSessionCompletedEvent(validEvent);

      expect(mockMentorPayableService.isDuplicate).toHaveBeenCalledWith(
        "session-123",
      );
      expect(mockMentorPayableService.getMentorPrice).toHaveBeenCalled();
      expect(mockMentorPayableService.createPerSessionBilling).toHaveBeenCalled();
    });

    it("should skip when duplicate detected", async () => {
      mockMentorPayableService.isDuplicate.mockResolvedValue(true);

      await listener.handleServiceSessionCompletedEvent(validEvent);

      expect(mockMentorPayableService.createPerSessionBilling).not.toHaveBeenCalled();
    });

    it("should skip when billing not allowed", async () => {
      const event = {
        ...validEvent,
        payload: { ...validEvent.payload, allowBilling: false },
      };
      mockMentorPayableService.isDuplicate.mockResolvedValue(false);

      await listener.handleServiceSessionCompletedEvent(event);

      expect(mockMentorPayableService.createPerSessionBilling).not.toHaveBeenCalled();
    });

    it("should skip when mentor price not found", async () => {
      mockMentorPayableService.isDuplicate.mockResolvedValue(false);
      mockMentorPayableService.getMentorPrice.mockResolvedValue(null);

      await listener.handleServiceSessionCompletedEvent(validEvent);

      expect(mockMentorPayableService.createPerSessionBilling).not.toHaveBeenCalled();
    });

    it("should skip when sessionId is missing", async () => {
      const event = {
        ...validEvent,
        payload: { ...validEvent.payload, sessionId: undefined },
      };

      await listener.handleServiceSessionCompletedEvent(event);

      expect(mockMentorPayableService.createPerSessionBilling).not.toHaveBeenCalled();
    });

    it("should use refrenceId if provided", async () => {
      const event = {
        ...validEvent,
        payload: {
          ...validEvent.payload,
          refrenceId: "custom-ref-id",
        },
      };
      mockMentorPayableService.isDuplicate.mockResolvedValue(false);
      mockMentorPayableService.getMentorPrice.mockResolvedValue(
        mockMentorPrice as any,
      );
      mockMentorPayableService.createPerSessionBilling.mockResolvedValue();

      await listener.handleServiceSessionCompletedEvent(event);

      expect(mockMentorPayableService.isDuplicate).toHaveBeenCalledWith(
        "custom-ref-id",
      );
    });

    it("should throw error when createPerSessionBilling fails", async () => {
      mockMentorPayableService.isDuplicate.mockResolvedValue(false);
      mockMentorPayableService.getMentorPrice.mockResolvedValue(
        mockMentorPrice as any,
      );
      mockMentorPayableService.createPerSessionBilling.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        listener.handleServiceSessionCompletedEvent(validEvent),
      ).rejects.toThrow("Database error");
    });
  });
});


