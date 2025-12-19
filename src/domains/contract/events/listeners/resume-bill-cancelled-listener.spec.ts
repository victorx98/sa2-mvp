import { Test, TestingModule } from "@nestjs/testing";
import { ResumeBillCancelledListener } from "./resume-bill-cancelled-listener";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import {
  IResumeBillCancelledEvent,
  RESUME_BILL_CANCELLED_EVENT,
} from "@shared/events/resume-bill-cancelled.event";

// Mock dependencies
const mockServiceLedgerService = {
  recordRefund: jest.fn(),
};

describe("ResumeBillCancelledListener", () => {
  let listener: ResumeBillCancelledListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeBillCancelledListener,
        {
          provide: ServiceLedgerService,
          useValue: mockServiceLedgerService,
        },
      ],
    }).compile();

    listener = module.get<ResumeBillCancelledListener>(ResumeBillCancelledListener);

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementation to default resolved value
    mockServiceLedgerService.recordRefund.mockResolvedValue({});
  });

  describe("handleResumeBillCancelledEvent", () => {
    it("should record refund for resume review service", async () => {
      // Arrange
      const resumeId = "resume-123";
      const studentId = "student-123";
      const mentorId = "mentor-123";
      const jobTitle = "Software Engineer";
      const event: IResumeBillCancelledEvent = {
        id: "event-123",
        type: RESUME_BILL_CANCELLED_EVENT,
        timestamp: Date.now(),
        payload: {
          resumeId,
          studentId,
          mentorId,
          jobTitle,
          description: "Cancelled due to student request",
          cancelledAt: new Date(),
        },
      };

      // Act
      await listener.handleResumeBillCancelledEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalledWith({
        studentId,
        serviceType: "resume_review",
        quantity: 1,
        relatedBookingId: resumeId,
        bookingSource: "resumes",
        createdBy: studentId,
      });
    });

    it("should handle missing required fields gracefully", async () => {
      // Arrange
      const event: IResumeBillCancelledEvent = {
        id: "event-123",
        type: RESUME_BILL_CANCELLED_EVENT,
        timestamp: Date.now(),
        payload: {
          resumeId: "resume-123",
          studentId: "", // Missing studentId
          mentorId: "mentor-123",
          jobTitle: "Software Engineer",
          cancelledAt: new Date(),
        },
      };

      // Act
      await listener.handleResumeBillCancelledEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).not.toHaveBeenCalled();
    });

    it("should handle recordRefund exception", async () => {
      // Arrange
      const resumeId = "resume-123";
      const studentId = "student-123";
      const mentorId = "mentor-123";
      const jobTitle = "Software Engineer";
      const event: IResumeBillCancelledEvent = {
        id: "event-123",
        type: RESUME_BILL_CANCELLED_EVENT,
        timestamp: Date.now(),
        payload: {
          resumeId,
          studentId,
          mentorId,
          jobTitle,
          cancelledAt: new Date(),
        },
      };

      // Mock exception
      const mockError = new Error("Test error");
      mockServiceLedgerService.recordRefund.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        listener.handleResumeBillCancelledEvent(event),
      ).rejects.toThrow(mockError);
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalled();
    });

    it("should handle optional description field", async () => {
      // Arrange
      const resumeId = "resume-123";
      const studentId = "student-123";
      const mentorId = "mentor-123";
      const jobTitle = "Software Engineer";
      const event: IResumeBillCancelledEvent = {
        id: "event-123",
        type: RESUME_BILL_CANCELLED_EVENT,
        timestamp: Date.now(),
        payload: {
          resumeId,
          studentId,
          mentorId,
          jobTitle,
          description: "Student decided to postpone job search",
          cancelledAt: new Date(),
        },
      };

      // Act
      await listener.handleResumeBillCancelledEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalledWith({
        studentId,
        serviceType: "resume_review",
        quantity: 1,
        relatedBookingId: resumeId,
        bookingSource: "resumes",
        createdBy: studentId,
      });
    });
  });
});
