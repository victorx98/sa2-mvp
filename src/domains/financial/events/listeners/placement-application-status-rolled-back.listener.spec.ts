import { Test, TestingModule } from "@nestjs/testing";
import { PlacementApplicationStatusRolledBackListener } from "./placement-application-status-rolled-back.listener";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import * as schema from "@infrastructure/database/schema";
import { eq, and } from "drizzle-orm";

// Mock dependencies
jest.mock("@domains/financial/services/mentor-payable.service");

// Mock database connection
const mockDb = {
  query: {
    jobApplications: {
      findFirst: jest.fn(),
    },
    mentorPayableLedgers: {
      findMany: jest.fn(),
    },
  },
} as any;

describe("PlacementApplicationStatusRolledBackListener", () => {
  let listener: PlacementApplicationStatusRolledBackListener;
  let mentorPayableService: jest.Mocked<MentorPayableService>;
  let db: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementApplicationStatusRolledBackListener,
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

    listener = module.get<PlacementApplicationStatusRolledBackListener>(
      PlacementApplicationStatusRolledBackListener,
    );
    mentorPayableService = module.get("IMentorPayableService");
    db = module.get<DrizzleDatabase>(DATABASE_CONNECTION);
  });

  describe("handlePlacementApplicationStatusRolledBackEvent", () => {
    const mockEvent = {
      id: "event-id-456",
      timestamp: Date.now(),
      source: {
        domain: "placement",
        service: "job-application",
      },
      payload: {
        applicationId: "application-id-123",
        previousStatus: "recommended",
        newStatus: "submitted",
        changedBy: "user-id-123",
        changedAt: new Date().toISOString(),
        rollbackReason: "Status changed by mistake",
      },
      type: "placement.application.status_rolled_back",
    };

    it("should process valid event and adjust billing records", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "submitted",
      };

      const mockOriginalBillingRecords = [
        {
          id: "ledger-id-123",
          referenceId: "application-id-123",
          mentorId: "mentor-id-123",
          studentId: "student-id-123",
          sessionTypeCode: "recommended",
          price: "100.00",
          amount: "100.00",
          currency: "USD",
          originalId: null,
          adjustmentReason: null,
          createdBy: "mentor-id-123",
          createdAt: new Date(),
        },
      ];

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.mentorPayableLedgers.findMany as jest.Mock).mockResolvedValue(mockOriginalBillingRecords);
      (mentorPayableService.adjustPayableLedger as jest.Mock).mockResolvedValue(undefined);

      // Act
      await listener.handlePlacementApplicationStatusRolledBackEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalledWith({
        where: eq(schema.jobApplications.id, "application-id-123"),
      });
      expect(db.query.mentorPayableLedgers.findMany).toHaveBeenCalledWith({
        where: and(
          eq(schema.mentorPayableLedgers.referenceId, "application-id-123"),
          eq(schema.mentorPayableLedgers.sessionTypeCode, "recommended"),
          eq(schema.mentorPayableLedgers.originalId, null),
        ),
      });
      expect(mentorPayableService.adjustPayableLedger).toHaveBeenCalledWith({
        originalLedgerId: "ledger-id-123",
        adjustmentAmount: -100.00,
        reason: "Placement application status rolled back: Status changed by mistake",
        createdBy: "user-id-123",
      });
    });

    it("should skip processing if event payload is invalid", async () => {
      // Arrange
      const invalidEvent = {
        ...mockEvent,
        payload: {
          // Missing required fields
          applicationId: "application-id-123",
          changedBy: "user-id-123",
          changedAt: new Date().toISOString(),
          rollbackReason: "Status changed by mistake",
        },
      };

      // Act
      await listener.handlePlacementApplicationStatusRolledBackEvent(invalidEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).not.toHaveBeenCalled();
      expect(mentorPayableService.adjustPayableLedger).not.toHaveBeenCalled();
    });

    it("should skip processing if job application not found", async () => {
      // Arrange
      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await listener.handlePlacementApplicationStatusRolledBackEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.mentorPayableLedgers.findMany).not.toHaveBeenCalled();
      expect(mentorPayableService.adjustPayableLedger).not.toHaveBeenCalled();
    });

    it("should skip processing if no original billing records found", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "submitted",
      };

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.mentorPayableLedgers.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      await listener.handlePlacementApplicationStatusRolledBackEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.mentorPayableLedgers.findMany).toHaveBeenCalled();
      expect(mentorPayableService.adjustPayableLedger).not.toHaveBeenCalled();
    });

    it("should adjust multiple billing records if found", async () => {
      // Arrange
      const mockJobApplication = {
        id: "application-id-123",
        studentId: "student-id-123",
        jobId: "job-id-123",
        applicationType: "direct",
        status: "submitted",
      };

      const mockOriginalBillingRecords = [
        {
          id: "ledger-id-123",
          referenceId: "application-id-123",
          mentorId: "mentor-id-123",
          studentId: "student-id-123",
          sessionTypeCode: "recommended",
          price: "100.00",
          amount: "100.00",
          currency: "USD",
          originalId: null,
          adjustmentReason: null,
          createdBy: "mentor-id-123",
          createdAt: new Date(),
        },
        {
          id: "ledger-id-456",
          referenceId: "application-id-123",
          mentorId: "mentor-id-123",
          studentId: "student-id-123",
          sessionTypeCode: "recommended",
          price: "50.00",
          amount: "50.00",
          currency: "USD",
          originalId: null,
          adjustmentReason: null,
          createdBy: "mentor-id-123",
          createdAt: new Date(),
        },
      ];

      (db.query.jobApplications.findFirst as jest.Mock).mockResolvedValue(mockJobApplication);
      (db.query.mentorPayableLedgers.findMany as jest.Mock).mockResolvedValue(mockOriginalBillingRecords);
      (mentorPayableService.adjustPayableLedger as jest.Mock).mockResolvedValue(undefined);

      // Act
      await listener.handlePlacementApplicationStatusRolledBackEvent(mockEvent as any);

      // Assert
      expect(db.query.jobApplications.findFirst).toHaveBeenCalled();
      expect(db.query.mentorPayableLedgers.findMany).toHaveBeenCalled();
      expect(mentorPayableService.adjustPayableLedger).toHaveBeenCalledTimes(2);
      expect(mentorPayableService.adjustPayableLedger).toHaveBeenNthCalledWith(1, {
        originalLedgerId: "ledger-id-123",
        adjustmentAmount: -100.00,
        reason: "Placement application status rolled back: Status changed by mistake",
        createdBy: "user-id-123",
      });
      expect(mentorPayableService.adjustPayableLedger).toHaveBeenNthCalledWith(2, {
        originalLedgerId: "ledger-id-456",
        adjustmentAmount: -50.00,
        reason: "Placement application status rolled back: Status changed by mistake",
        createdBy: "user-id-123",
      });
    });
  });
});
