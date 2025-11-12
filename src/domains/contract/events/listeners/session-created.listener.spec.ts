import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import {
  SessionCreatedListener,
  ISessionCreatedEvent,
} from "./session-created.listener";
import { ServiceHoldService } from "../../services/service-hold.service";

// Suppress Logger for tests
jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

describe("SessionCreatedListener", () => {
  let listener: SessionCreatedListener;
  let serviceHoldService: ServiceHoldService;

  const createMockServiceHoldService = () => ({
    updateRelatedBooking: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCreatedListener,
        {
          provide: ServiceHoldService,
          useValue: createMockServiceHoldService(),
        },
      ],
    }).compile();

    listener = module.get<SessionCreatedListener>(SessionCreatedListener);
    serviceHoldService = module.get<ServiceHoldService>(ServiceHoldService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleSessionCreated", () => {
    it("should update related booking ID when event received", async () => {
      // Arrange
      const event: ISessionCreatedEvent = {
        sessionId: "session-123",
        holdId: "hold-456",
        contractId: "contract-789",
        studentId: "student-999",
        serviceType: "resume_review",
      };

      // Act
      await listener.handleSessionCreated(event);

      // Assert
      expect(serviceHoldService.updateRelatedBooking).toHaveBeenCalledWith(
        "hold-456",
        "session-123",
      );
      expect(serviceHoldService.updateRelatedBooking).toHaveBeenCalledTimes(1);
    });

    it("should handle errors and re-throw", async () => {
      // Arrange
      const event: ISessionCreatedEvent = {
        sessionId: "session-123",
        holdId: "hold-456",
        contractId: "contract-789",
        studentId: "student-999",
        serviceType: "resume_review",
      };

      const error = new Error("Update failed");
      jest
        .spyOn(serviceHoldService, "updateRelatedBooking")
        .mockRejectedValue(error);

      // Act & Assert
      await expect(listener.handleSessionCreated(event)).rejects.toThrow(
        "Update failed",
      );
      expect(serviceHoldService.updateRelatedBooking).toHaveBeenCalledWith(
        "hold-456",
        "session-123",
      );
    });
  });
});
