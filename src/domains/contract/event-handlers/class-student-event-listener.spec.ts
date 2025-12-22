import { Test, TestingModule } from "@nestjs/testing";
import { ClassStudentEventListener } from "./class-student-event-listener";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import {
  CLASS_STUDENT_ADDED_EVENT,
  IClassStudentAddedEvent,
  IClassStudentAddedPayload,
} from "@shared/events/class-student-added.event";
import {
  CLASS_STUDENT_REMOVED_EVENT,
  IClassStudentRemovedEvent,
  IClassStudentRemovedPayload,
} from "@shared/events/class-student-removed.event";

// Mock dependencies
const mockServiceLedgerService = {
  recordConsumption: jest.fn(),
  recordRefund: jest.fn(),
};

describe("ClassStudentEventListener", () => {
  let listener: ClassStudentEventListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassStudentEventListener,
        {
          provide: ServiceLedgerService,
          useValue: mockServiceLedgerService,
        },
      ],
    }).compile();

    listener = module.get<ClassStudentEventListener>(ClassStudentEventListener);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("handleClassStudentAddedEvent", () => {
    it("should record consumption for class entitlement when student joins class", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";
      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        deductionQuantity: 1,
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: 1,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should handle custom deduction quantity", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";
      const customDeductionQuantity = 2;

      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        deductionQuantity: customDeductionQuantity,
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: customDeductionQuantity,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should use default deduction quantity of 1 when not provided", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        // deductionQuantity not provided, should default to 1
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: 1,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should handle missing required fields gracefully", async () => {
      // Arrange
      const eventPayload: Partial<IClassStudentAddedPayload> = {
        classId: "class-123",
        studentId: "", // Missing studentId
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload as IClassStudentAddedPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).not.toHaveBeenCalled();
    });

    it("should handle invalid deduction quantity (0)", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        deductionQuantity: 0, // Invalid: should be positive
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert - should return early due to invalid deduction quantity
      expect(mockServiceLedgerService.recordConsumption).not.toHaveBeenCalled();
    });

    it("should handle negative deduction quantity", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        deductionQuantity: -1, // Invalid: should be positive
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert - should return early due to invalid deduction quantity
      expect(mockServiceLedgerService.recordConsumption).not.toHaveBeenCalled();
    });

    it("should include optional description field", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        description: "Advanced React Development Course",
        studentId,
        operatedAt: new Date(),
        deductionQuantity: 1,
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentAddedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: 1,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should handle recordConsumption exception", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentAddedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        deductionQuantity: 1,
      };

      const event: IClassStudentAddedEvent = {
        id: "event-123",
        type: CLASS_STUDENT_ADDED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Mock exception
      const mockError = new Error("Test error");
      mockServiceLedgerService.recordConsumption.mockRejectedValue(mockError);

      // Act & Assert
      await expect(listener.handleClassStudentAddedEvent(event)).rejects.toThrow(
        mockError,
      );
      expect(mockServiceLedgerService.recordConsumption).toHaveBeenCalled();
    });
  });

  describe("handleClassStudentRemovedEvent", () => {
    it("should record refund for class entitlement when student leaves class", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        refundQuantity: 1,
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: 1,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should handle custom refund quantity", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";
      const customRefundQuantity = 2;

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        refundQuantity: customRefundQuantity,
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: customRefundQuantity,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should use default refund quantity of 1 when not provided", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        // refundQuantity not provided, should default to 1
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: 1,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should handle missing required fields gracefully", async () => {
      // Arrange
      const eventPayload: Partial<IClassStudentRemovedPayload> = {
        classId: "class-123",
        studentId: "", // Missing studentId
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload as IClassStudentRemovedPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).not.toHaveBeenCalled();
    });

    it("should handle invalid refund quantity (0)", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        refundQuantity: 0, // Invalid: should be positive
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert - should return early due to invalid refund quantity
      expect(mockServiceLedgerService.recordRefund).not.toHaveBeenCalled();
    });

    it("should handle negative refund quantity", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        refundQuantity: -1, // Invalid: should be positive
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert - should return early due to invalid refund quantity
      expect(mockServiceLedgerService.recordRefund).not.toHaveBeenCalled();
    });

    it("should include optional description field", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        description: "Student withdrew due to schedule conflict",
        studentId,
        operatedAt: new Date(),
        refundQuantity: 1,
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Act
      await listener.handleClassStudentRemovedEvent(event);

      // Assert
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalledWith({
        studentId,
        serviceType: "class",
        quantity: 1,
        relatedBookingId: classId,
        bookingSource: "classes",
        createdBy: studentId,
      });
    });

    it("should handle recordRefund exception", async () => {
      // Arrange
      const classId = "class-123";
      const studentId = "student-123";

      const eventPayload: IClassStudentRemovedPayload = {
        classId,
        name: "Test Class",
        type: "regular",
        status: "active",
        startDate: new Date(),
        endDate: new Date(),
        studentId,
        operatedAt: new Date(),
        refundQuantity: 1,
      };

      const event: IClassStudentRemovedEvent = {
        id: "event-456",
        type: CLASS_STUDENT_REMOVED_EVENT,
        timestamp: Date.now(),
        payload: eventPayload,
      };

      // Mock exception
      const mockError = new Error("Test error");
      mockServiceLedgerService.recordRefund.mockRejectedValue(mockError);

      // Act & Assert
      await expect(listener.handleClassStudentRemovedEvent(event)).rejects.toThrow(
        mockError,
      );
      expect(mockServiceLedgerService.recordRefund).toHaveBeenCalled();
    });
  });
});
