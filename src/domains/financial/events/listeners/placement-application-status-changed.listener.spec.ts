import { Test, TestingModule } from "@nestjs/testing";
import { PlacementApplicationStatusChangedListener } from "./placement-application-status-changed.listener";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import * as schema from "@infrastructure/database/schema";
import { eq } from "drizzle-orm";

// Mock dependencies
jest.mock("@domains/financial/services/mentor-payable.service");

// Mock database connection
const mockDb = {
  query: {
    jobApplications: {
      findFirst: jest.fn(),
    },
    studentMentorTable: {
      findFirst: jest.fn(),
    },
  },
} as any;

describe("PlacementApplicationStatusChangedListener", () => {
  let listener: PlacementApplicationStatusChangedListener;
  let mentorPayableService: jest.Mocked<MentorPayableService>;
  let db: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementApplicationStatusChangedListener,
        {
          provide: "IMentorPayableService",
          useClass: MentorPayableService,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    listener = module.get<PlacementApplicationStatusChangedListener>(
      PlacementApplicationStatusChangedListener,
    );
    mentorPayableService = module.get("IMentorPayableService");
    db = module.get<DrizzleDatabase>(DATABASE_CONNECTION);
  });

  describe("handlePlacementApplicationStatusChangedEvent", () => {
    const mockEvent = {
      id: "event-id-123",
      timestamp: Date.now(),
      source: {
        domain: "placement",
        service: "job-application",
      },
      payload: {
        applicationId: "application-id-123",
        previousStatus: "submitted",
        newStatus: "recommended",
        changedBy: "user-id-123",
        changedAt: new Date().toISOString(),
      },
      type: "placement.application.status_changed",
    };

    it("should process valid event and create billing record", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "recommended",
      };

      const mockStudentMentor = {
        id: "student-mentor-id-123",
        studentId: "student-id-123",
        mentorId: "mentor-id-123",
      };

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.studentMentorTable.findFirst as jest.Mock).mockResolvedValue(mockStudentMentor);
      (mentorPayableService.isDuplicate as jest.Mock).mockResolvedValue(false);
      (mentorPayableService.getMentorPrice as jest.Mock).mockResolvedValue({
        id: "price-id-123",
        mentorId: "mentor-id-123",
        price: "100.00",
        currency: "USD",
        sessionTypeCode: "recommended",
        status: "active",
      });
      (mentorPayableService.createPlacementBilling as jest.Mock).mockResolvedValue(undefined);

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalledWith({
        where: eq(schema.jobApplications.id, "application-id-123"),
      });
      expect(db.query.studentMentorTable.findFirst).toHaveBeenCalledWith({
        where: eq(schema.studentMentorTable.studentId, "student-id-123"),
      });
      expect(mentorPayableService.isDuplicate).toHaveBeenCalledWith("application-id-123");
      expect(mentorPayableService.getMentorPrice).toHaveBeenCalledWith("mentor-id-123", "recommended");
      expect(mentorPayableService.createPlacementBilling).toHaveBeenCalledWith({
        applicationId: "application-id-123",
        studentId: "student-id-123",
        mentorId: "mentor-id-123",
        sessionTypeCode: "recommended",
        allowBilling: true,
      });
    });

    it("should skip processing if event payload is invalid", async () => {
      // Arrange
      const invalidEvent = {
        ...mockEvent,
        payload: {
          // Missing required fields
          previousStatus: "submitted",
          changedBy: "user-id-123",
          changedAt: new Date().toISOString(),
        },
      };

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(invalidEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).not.toHaveBeenCalled();
      expect(mentorPayableService.createPlacementBilling).not.toHaveBeenCalled();
    });

    it("should skip processing if job application not found", async () => {
      // Arrange
      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.studentMentorTable.findFirst).not.toHaveBeenCalled();
      expect(mentorPayableService.createPlacementBilling).not.toHaveBeenCalled();
    });

    it("should skip processing if student has no mentor", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "recommended",
      };

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.studentMentorTable.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.studentMentorTable.findFirst).toHaveBeenCalled();
      expect(mentorPayableService.createPlacementBilling).not.toHaveBeenCalled();
    });

    it("should skip processing if status change is not billable", async () => {
      // Arrange
      const nonBillableEvent = {
        ...mockEvent,
        payload: {
          ...mockEvent.payload,
          newStatus: "submitted", // Not in billable status changes
        },
      };

      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "submitted",
      };

      const mockStudentMentor = {
        id: "student-mentor-id-123",
        studentId: "student-id-123",
        mentorId: "mentor-id-123",
      };

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.studentMentorTable.findFirst as jest.Mock).mockResolvedValue(mockStudentMentor);

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(nonBillableEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.studentMentorTable.findFirst).not.toHaveBeenCalled();
      expect(mentorPayableService.isDuplicate).not.toHaveBeenCalled();
      expect(mentorPayableService.createPlacementBilling).not.toHaveBeenCalled();
    });

    it("should skip processing if duplicate event", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "recommended",
      };

      const mockStudentMentor = {
        id: "student-mentor-id-123",
        studentId: "student-id-123",
        mentorId: "mentor-id-123",
      };

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.studentMentorTable.findFirst as jest.Mock).mockResolvedValue(mockStudentMentor);
      (mentorPayableService.isDuplicate as jest.Mock).mockResolvedValue(true);

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.studentMentorTable.findFirst).toHaveBeenCalled();
      expect(mentorPayableService.isDuplicate).toHaveBeenCalled();
      expect(mentorPayableService.getMentorPrice).not.toHaveBeenCalled();
      expect(mentorPayableService.createPlacementBilling).not.toHaveBeenCalled();
    });

    it("should skip processing if no mentor price found", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "recommended",
      };

      const mockStudentMentor = {
        id: "student-mentor-id-123",
        studentId: "student-id-123",
        mentorId: "mentor-id-123",
      };

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.studentMentorTable.findFirst as jest.Mock).mockResolvedValue(mockStudentMentor);
      (mentorPayableService.isDuplicate as jest.Mock).mockResolvedValue(false);
      (mentorPayableService.getMentorPrice as jest.Mock).mockResolvedValue(null);

      // Act
      await listener.handlePlacementApplicationStatusChangedEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.studentMentorTable.findFirst).toHaveBeenCalled();
      expect(mentorPayableService.isDuplicate).toHaveBeenCalled();
      expect(mentorPayableService.getMentorPrice).toHaveBeenCalled();
      expect(mentorPayableService.createPlacementBilling).not.toHaveBeenCalled();
    });
  });
});
