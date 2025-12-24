import { Test, TestingModule } from "@nestjs/testing";
import { ResumeBilledListener } from "@application/events/handlers/contract/resume-billed-listener";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { ResumeBilledEvent } from "@application/events";
import { SERVICE_TYPES, BOOKING_SOURCES } from "@domains/contract/common/constants/service-types.constants";
import { createEventListenerTestingModule } from "test/utils/contract-test.helper";

// Mock dependencies
const mockServiceLedgerService = {
  recordConsumption: jest.fn(),
};

describe("ResumeBilledListener", () => {
  let listener: ResumeBilledListener;

  beforeEach(async () => {
    const module: TestingModule = await createEventListenerTestingModule(
      ResumeBilledListener,
      mockServiceLedgerService,
      ServiceLedgerService,
    );

    listener = module.get<ResumeBilledListener>(ResumeBilledListener);

    // Clear all mocks before each test
    jest.clearAllMocks();
    mockServiceLedgerService.recordConsumption.mockResolvedValue({});
  });

  describe("handleResumeBilledEvent", () => {
    it("should record consumption for resume review service", async () => {
      // Arrange
      const resumeId = "resume-123";
      const studentId = "student-123";
      const mentorId = "mentor-123";
      const jobTitle = "Software Engineer";
      const event = new ResumeBilledEvent({
        resumeId,
        studentId,
        mentorId,
        jobTitle,
        description: "Resume review request",
        billedAt: new Date(),
      });

      // Act
      await listener.handleResumeBilledEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: SERVICE_TYPES.RESUME_REVIEW,
        quantity: 1,
        relatedBookingId: resumeId,
        bookingSource: BOOKING_SOURCES.RESUMES,
        createdBy: studentId,
      });
    });

    it("should handle missing required fields gracefully", async () => {
      // Arrange
      const event = new ResumeBilledEvent({
        resumeId: "resume-123",
        studentId: "", // Missing studentId
        mentorId: "mentor-123",
        jobTitle: "Software Engineer",
        billedAt: new Date(),
      });

      // Act
      await listener.handleResumeBilledEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).not.toHaveBeenCalled();
    });

    it("should handle recordConsumption exception", async () => {
      // Arrange
      const resumeId = "resume-123";
      const studentId = "student-123";
      const mentorId = "mentor-123";
      const jobTitle = "Software Engineer";
      const event = new ResumeBilledEvent({
        resumeId,
        studentId,
        mentorId,
        jobTitle,
        billedAt: new Date(),
      });

      // Mock exception - reset mock first
      mockServiceLedgerService.recordConsumption = jest.fn().mockRejectedValue(new Error("Test error"));

      // Act & Assert
      await expect(listener.handleResumeBilledEvent(event)).rejects.toThrow("Test error");
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalled();
    });

    it("should handle optional description field", async () => {
      // Arrange
      // Reset mock before this test
      mockServiceLedgerService.recordConsumption = jest.fn().mockResolvedValue({});

      const resumeId = "resume-123";
      const studentId = "student-123";
      const mentorId = "mentor-123";
      const jobTitle = "Software Engineer";
      const event = new ResumeBilledEvent({
        resumeId,
        studentId,
        mentorId,
        jobTitle,
        description: "Please review my resume for FAANG companies",
        billedAt: new Date(),
      });

      // Act
      await listener.handleResumeBilledEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
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
