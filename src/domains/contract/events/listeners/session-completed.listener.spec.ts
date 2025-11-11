import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { SessionCompletedListener } from "./session-completed.listener";
import { ContractService } from "../../services/contract.service";
import { IEventPublisher } from "../../services/event-publisher.service";
import { ISessionCompletedEvent } from "../../common/types/event.types";

// Suppress Logger for tests
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

describe("SessionCompletedListener", () => {
  let listener: SessionCompletedListener;
  let mockContractService: any;
  let mockEventPublisher: any;

  beforeEach(async () => {
    mockContractService = {
      consumeService: jest.fn(),
    };

    mockEventPublisher = {
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCompletedListener,
        {
          provide: ContractService,
          useValue: mockContractService,
        },
        {
          provide: "EVENT_PUBLISHER",
          useValue: mockEventPublisher,
        },
      ],
    }).compile();

    listener = module.get<SessionCompletedListener>(SessionCompletedListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("should subscribe to session.completed events", () => {
      // Act
      listener.onModuleInit();

      // Assert
      expect(mockEventPublisher.subscribe).toHaveBeenCalledWith(
        "session.completed",
        expect.any(Function),
      );
    });
  });

  describe("handleSessionCompleted", () => {
    it("should consume service successfully when session completed", async () => {
      // Arrange
      const event: ISessionCompletedEvent = {
        id: "event-123",
        eventType: "session.completed",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          contractId: "contract-789",
          studentId: "student-111",
          createdBy: "mentor-222",
          serviceType: "resume_review",
          holdId: "hold-333",
        },
      };

      // Act
      await listener["handleSessionCompleted"](event);

      // Assert
      expect(mockContractService.consumeService).toHaveBeenCalledWith({
        contractId: "contract-789",
        studentId: "student-111",
        serviceType: "resume_review",
        quantity: 1,
        relatedBookingId: "session-456",
        relatedHoldId: "hold-333",
        createdBy: "mentor-222",
      });
    });

    it("should handle session without holdId", async () => {
      // Arrange
      const event: ISessionCompletedEvent = {
        id: "event-123",
        eventType: "session.completed",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          contractId: "contract-789",
          studentId: "student-111",
          createdBy: "mentor-222",
          serviceType: "mock_interview",
          // No holdId
        },
      };

      // Act
      await listener["handleSessionCompleted"](event);

      // Assert
      expect(mockContractService.consumeService).toHaveBeenCalledWith({
        contractId: "contract-789",
        studentId: "student-111",
        serviceType: "mock_interview",
        quantity: 1,
        relatedBookingId: "session-456",
        relatedHoldId: undefined,
        createdBy: "mentor-222",
      });
    });

    it("should handle session without mentor (createdBy is null)", async () => {
      // Arrange - For services without mentor (e.g., mock interview)
      const event: ISessionCompletedEvent = {
        id: "event-123",
        eventType: "session.completed",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          contractId: "contract-789",
          studentId: "student-111",
          serviceType: "mock_interview",
          // createdBy is undefined/null for services without mentor
        },
      };

      // Act
      await listener["handleSessionCompleted"](event);

      // Assert
      expect(mockContractService.consumeService).toHaveBeenCalledWith({
        contractId: "contract-789",
        studentId: "student-111",
        serviceType: "mock_interview",
        quantity: 1,
        relatedBookingId: "session-456",
        relatedHoldId: undefined,
        createdBy: undefined, // Upstream system (Session Domain) decided not to provide createdBy
      });
    });

    it("should handle missing sessionId", async () => {
      // Arrange - Use 'as any' to bypass type checking for testing missing field scenario
      const event = {
        id: "event-123",
        eventType: "session.completed",
        timestamp: new Date(),
        payload: {
          contractId: "contract-789",
          studentId: "student-111",
          serviceType: "resume_review",
          // Missing sessionId
        },
      } as any;

      // Act
      await listener["handleSessionCompleted"](event);

      // Assert
      expect(mockContractService.consumeService).not.toHaveBeenCalled();
    });

    it("should handle missing contractId", async () => {
      // Arrange - Use 'as any' to bypass type checking for testing missing field scenario
      const event = {
        id: "event-123",
        eventType: "session.completed",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          studentId: "student-111",
          serviceType: "resume_review",
          // Missing contractId
        },
      } as any;

      // Act
      await listener["handleSessionCompleted"](event);

      // Assert
      expect(mockContractService.consumeService).not.toHaveBeenCalled();
    });


    it("should throw error for unexpected failures", async () => {
      // Arrange
      const event: ISessionCompletedEvent = {
        id: "event-123",
        eventType: "session.completed",
        timestamp: new Date(),
        payload: {
          sessionId: "session-456",
          contractId: "contract-789",
          studentId: "student-111",
          serviceType: "resume_review",
        },
      };

      mockContractService.consumeService.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(listener["handleSessionCompleted"](event)).rejects.toThrow("Database error");
    });
  });
});
