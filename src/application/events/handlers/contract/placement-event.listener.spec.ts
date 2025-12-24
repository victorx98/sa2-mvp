import { Test, TestingModule } from "@nestjs/testing";
import { PlacementEventListener } from "@application/events/handlers/contract/placement-event.listener";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  JobApplicationStatusChangedEvent,
  JobApplicationStatusRolledBackEvent,
} from "@application/events";

// Mock dependencies
const mockServiceLedgerService = {
  recordConsumption: jest.fn(),
  recordAdjustment: jest.fn(),
};

const mockDatabase = {
  query: {
    jobApplications: {
      findFirst: jest.fn(),
    },
  },
};

describe("PlacementEventListener", () => {
  let listener: PlacementEventListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementEventListener,
        {
          provide: ServiceLedgerService,
          useValue: mockServiceLedgerService,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    listener = module.get<PlacementEventListener>(PlacementEventListener);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("handleApplicationStatusChangedEvent", () => {
    it("should record consumption when status changes to submitted", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const applicationType = "direct";
      const event = new JobApplicationStatusChangedEvent({
        applicationId,
        previousStatus: "mentor_assigned",
        newStatus: "submitted",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
      });

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
        applicationType,
      });

      // Act
      await listener.handleApplicationStatusChangedEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();

      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: "job_application",
        quantity: 1,
        relatedBookingId: applicationId,
        bookingSource: "job_applications", // Verify bookingSource is passed [验证bookingSource已传递]
        createdBy: "user-123",
      });
    });

    it("should not record consumption when status is not submitted", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const applicationType = "direct";
      const event = new JobApplicationStatusChangedEvent({
        applicationId,
        previousStatus: "mentor_assigned",
        newStatus: "interviewed",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
      });

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
        applicationType,
      });

      // Act
      await listener.handleApplicationStatusChangedEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordConsumption).not.toHaveBeenCalled();
    });

    it("should return early if job application not found", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const eventPayload = {
        applicationId,
        previousStatus: "mentor_assigned",
        newStatus: "submitted",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
      };
      const event = new JobApplicationStatusChangedEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue(null);

      // Act
      await listener.handleApplicationStatusChangedEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordConsumption).not.toHaveBeenCalled();
    });

    it("should use system as createdBy when changedBy is undefined", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const applicationType = "direct";
      const eventPayload = {
        applicationId,
        previousStatus: "mentor_assigned",
        newStatus: "submitted",
        changedAt: new Date().toISOString(),
      };
      const event = new JobApplicationStatusChangedEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
        applicationType,
      });

      // Act
      await listener.handleApplicationStatusChangedEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: "job_application",
        quantity: 1,
        relatedBookingId: applicationId,
        bookingSource: "job_applications", // Verify bookingSource is passed [验证bookingSource已传递]
        createdBy: "system",
      });
    });

    it("should handle different application types", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const applicationTypes = ["direct", "proxy", "referral", "bd"];

      for (const applicationType of applicationTypes) {
        // Clear mocks for each iteration
        jest.clearAllMocks();

        const eventPayload = {
          applicationId,
          previousStatus: "mentor_assigned",
          newStatus: "submitted",
          changedBy: "user-123",
          changedAt: new Date().toISOString(),
        };
        const event = new JobApplicationStatusChangedEvent(eventPayload);

        // Mock database response
        mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
          studentId,
          applicationType,
        });

        // Act
        await listener.handleApplicationStatusChangedEvent(event);

        // Assert
        expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
        expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith(
          {
            studentId,
            serviceType: "job_application",
            quantity: 1,
            relatedBookingId: applicationId,
            bookingSource: "job_applications", // Verify bookingSource is passed [验证bookingSource已传递]
            createdBy: "user-123",
          },
        );
      }
    });

    it("should handle recordConsumption exception", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const applicationType = "direct";
      const eventPayload = {
        applicationId,
        previousStatus: "mentor_assigned",
        newStatus: "submitted",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
      };
      const event = new JobApplicationStatusChangedEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
        applicationType,
      });

      // Mock exception
      const mockError = new Error("Test error");
      mockServiceLedgerService.recordConsumption.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        listener.handleApplicationStatusChangedEvent(event),
      ).rejects.toThrow(mockError);
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalled();
    });
  });

  describe("handleApplicationStatusRolledBackEvent", () => {
    it("should record refund when status rolls back from submitted", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const rollbackReason = "Test rollback reason";
      const eventPayload = {
        applicationId,
        previousStatus: "submitted",
        newStatus: "mentor_assigned",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
        rollbackReason,
      };
      const event = new JobApplicationStatusRolledBackEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
      });

      // Act
      await listener.handleApplicationStatusRolledBackEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();

      expect(mockServiceLedgerService.recordAdjustment).toHaveBeenCalledWith({
        studentId,
        serviceType: "job_application",
        quantity: 1,
        reason: `Job application status rolled back: ${rollbackReason}`,
        createdBy: "user-123",
      });
    });

    it("should not record refund when status does not roll back from submitted", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const rollbackReason = "Test rollback reason";
      const eventPayload = {
        applicationId,
        previousStatus: "interviewed",
        newStatus: "mentor_assigned",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
        rollbackReason,
      };
      const event = new JobApplicationStatusRolledBackEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
      });

      // Act
      await listener.handleApplicationStatusRolledBackEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordAdjustment).not.toHaveBeenCalled();
    });

    it("should return early if job application not found", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const rollbackReason = "Test rollback reason";
      const eventPayload = {
        applicationId,
        previousStatus: "submitted",
        newStatus: "mentor_assigned",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
        rollbackReason,
      };
      const event = new JobApplicationStatusRolledBackEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue(null);

      // Act
      await listener.handleApplicationStatusRolledBackEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordAdjustment).not.toHaveBeenCalled();
    });

    it("should use system as createdBy when changedBy is undefined", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const rollbackReason = "Test rollback reason";
      const eventPayload = {
        applicationId,
        previousStatus: "submitted",
        newStatus: "mentor_assigned",
        changedBy: "test-user-id",
        changedAt: new Date().toISOString(),
        rollbackReason,
      };
      const event = new JobApplicationStatusRolledBackEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
      });

      // Act
      await listener.handleApplicationStatusRolledBackEvent(event);

      // Assert
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();

      expect(mockServiceLedgerService.recordAdjustment).toHaveBeenCalledWith({
        studentId,
        serviceType: "job_application",
        quantity: 1,
        reason: `Job application status rolled back: ${rollbackReason}`,
        createdBy: "system",
      });
    });

    it("should handle recordAdjustment exception", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const rollbackReason = "Test rollback reason";
      const eventPayload = {
        applicationId,
        previousStatus: "submitted",
        newStatus: "mentor_assigned",
        changedBy: "user-123",
        changedAt: new Date().toISOString(),
        rollbackReason,
      };
      const event = new JobApplicationStatusRolledBackEvent(eventPayload);

      // Mock database response
      mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
        studentId,
      });

      // Mock exception
      const mockError = new Error("Test error");
      mockServiceLedgerService.recordAdjustment.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        listener.handleApplicationStatusRolledBackEvent(event),
      ).rejects.toThrow(mockError);
      expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(mockServiceLedgerService.recordAdjustment).toHaveBeenCalled();
    });

    it("should handle different rollback reasons", async () => {
      // Arrange
      const applicationId = "test-application-id";
      const studentId = "test-student-id";
      const rollbackReasons = [
        "Application withdrawn by student",
        "Incorrect application details",
        "Position no longer available",
        "Student decided to pursue other opportunities",
      ];

      for (const rollbackReason of rollbackReasons) {
        // Clear all mocks for each iteration
        jest.clearAllMocks();

        // Reset mock implementations
        mockServiceLedgerService.recordAdjustment = jest.fn();
        mockDatabase.query.jobApplications.findFirst = jest.fn();

        const eventPayload = {
          applicationId,
          previousStatus: "submitted",
          newStatus: "mentor_assigned",
          changedBy: "user-123",
          changedAt: new Date().toISOString(),
          rollbackReason,
        };
        const event = new JobApplicationStatusRolledBackEvent(eventPayload);

        // Mock database response
        mockDatabase.query.jobApplications.findFirst.mockResolvedValue({
          studentId,
        });

        // Act
        await listener.handleApplicationStatusRolledBackEvent(event);

        // Assert
        expect(mockDatabase.query.jobApplications.findFirst).toHaveBeenCalled();
        expect(mockServiceLedgerService.recordAdjustment).toHaveBeenCalledWith({
          studentId,
          serviceType: "job_application",
          quantity: 1,
          reason: `Job application status rolled back: ${rollbackReason}`,
          createdBy: "user-123",
        });
      }
    });
  });
});
