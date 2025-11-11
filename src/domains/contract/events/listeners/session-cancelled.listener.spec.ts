import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { SessionCancelledListener } from "./session-cancelled.listener";
import { ServiceHoldService } from "../../services/service-hold.service";
import { IEventPublisher } from "../../services/event-publisher.service";
import { ISessionCancelledEvent } from "../../common/types/event.types";

// Suppress Logger for tests
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

describe("SessionCancelledListener", () => {
  let listener: SessionCancelledListener;
  let mockHoldService: any;
  let mockEventPublisher: any;

  beforeEach(async () => {
    mockHoldService = {
      cancelHold: jest.fn(),
    };

    mockEventPublisher = {
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCancelledListener,
        {
          provide: ServiceHoldService,
          useValue: mockHoldService,
        },
        {
          provide: "EVENT_PUBLISHER",
          useValue: mockEventPublisher,
        },
      ],
    }).compile();

    listener = module.get<SessionCancelledListener>(SessionCancelledListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should subscribe to session.cancelled events", () => {
      // Act
      listener.onModuleInit();

      // Assert
      expect(mockEventPublisher.subscribe).toHaveBeenCalledWith(
        "session.cancelled",
        expect.any(Function),
      );
    });
  });

  describe("handleSessionCancelled", () => {
    it("should cancel hold successfully when session cancelled", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          holdId: "hold-789",
          cancelledBy: "student-111",
        },
      };

      const mockHold = {
        id: "hold-789",
        contractId: "contract-123",
        status: "cancelled",
      };

      mockHoldService.cancelHold.mockResolvedValue(mockHold);

      // Act
      await listener["handleSessionCancelled"](event);

      // Assert
      expect(mockHoldService.cancelHold).toHaveBeenCalledWith("hold-789", "cancelled");
    });

    it("should handle missing sessionId", async () => {
      // Arrange - Use 'as any' to bypass type checking for testing missing field scenario
      const event = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          holdId: "hold-789",
          cancelledBy: "student-111",
          // Missing sessionId
        },
      } as any;

      // Act
      await listener["handleSessionCancelled"](event);

      // Assert
      expect(mockHoldService.cancelHold).not.toHaveBeenCalled();
    });

    it("should handle missing holdId gracefully", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          cancelledBy: "student-111",
          // Missing holdId
        },
      };

      // Act
      await listener["handleSessionCancelled"](event);

      // Assert
      expect(mockHoldService.cancelHold).not.toHaveBeenCalled();
    });

    it("should handle session cancelled without associated hold", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          cancelledBy: "student-111",
          // No holdId
        },
      };

      // Act
      await listener["handleSessionCancelled"](event);

      // Assert
      expect(mockHoldService.cancelHold).not.toHaveBeenCalled();
    });

    it("should cancel hold with correct reason", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          holdId: "hold-789",
          cancelledBy: "student-111",
        },
      };

      const mockHold = {
        id: "hold-789",
        status: "cancelled",
      };

      mockHoldService.cancelHold.mockResolvedValue(mockHold);

      // Act
      await listener["handleSessionCancelled"](event);

      // Assert
      expect(mockHoldService.cancelHold).toHaveBeenCalledWith("hold-789", "cancelled");
      expect(mockHoldService.cancelHold).toHaveBeenCalledTimes(1);
    });

    it("should throw error for unexpected failures", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          holdId: "hold-789",
          cancelledBy: "student-111",
        },
      };

      mockHoldService.cancelHold.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(listener["handleSessionCancelled"](event)).rejects.toThrow("Database error");
    });

    it("should release service entitlement back to available balance", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          holdId: "hold-789",
          cancelledBy: "student-111",
        },
      };

      const mockHold = {
        id: "hold-789",
        contractId: "contract-123",
        serviceType: "resume_review",
        quantity: 1,
        status: "cancelled",
      };

      mockHoldService.cancelHold.mockResolvedValue(mockHold);

      // Act
      await listener["handleSessionCancelled"](event);

      // Assert
      // The hold is cancelled, which releases the entitlement back to available balance
      expect(mockHoldService.cancelHold).toHaveBeenCalledWith("hold-789", "cancelled");
    });

    it("should handle multiple cancellations of the same session", async () => {
      // Arrange
      const event: ISessionCancelledEvent = {
        id: "event-123",
        eventType: "session.cancelled",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          holdId: "hold-789",
          cancelledBy: "student-111",
        },
      };

      const mockHold = {
        id: "hold-789",
        status: "cancelled",
      };

      mockHoldService.cancelHold.mockResolvedValue(mockHold);

      // Act - First cancellation
      await listener["handleSessionCancelled"](event);

      // Act - Second cancellation (potential duplicate event)
      await listener["handleSessionCancelled"](event);

      // Assert - Should attempt to cancel both times (idempotency should be handled at service level)
      expect(mockHoldService.cancelHold).toHaveBeenCalledTimes(2);
      expect(mockHoldService.cancelHold).toHaveBeenCalledWith("hold-789", "cancelled");
    });
  });
});
