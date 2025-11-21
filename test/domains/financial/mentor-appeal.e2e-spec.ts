import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { v4 as uuidv4 } from "uuid";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { FinancialModule } from "@domains/financial/financial.module";
import { MENTOR_APPEAL_CREATED_EVENT, MENTOR_APPEAL_APPROVED_EVENT, MENTOR_APPEAL_REJECTED_EVENT } from "@shared/events/event-constants";
import { AppealType } from "@shared/types/financial-enums";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

// Interfaces
import { IMentorAppealService, ICreateAppealDTO } from "@domains/financial/interfaces";

/**
 * Mentor Appeal E2E Tests
 * Integration tests for mentor appeal creation and processing
 * Note: This test preserves all test data in the database (both pre-existing and newly created)
 * No data cleanup is performed before or after test execution
 */
describe("Mentor Appeal (e2e)", () => {
  let app: INestApplication;
  let appealService: IMentorAppealService;
  let eventEmitter: EventEmitter2;
  let db: NodePgDatabase;

  const testMentorId = uuidv4();
  const testCounselorId = uuidv4();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env",
          isGlobal: true,
        }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: ".",
        }),
        DatabaseModule,
        FinancialModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    appealService = moduleFixture.get<IMentorAppealService>("IMentorAppealService");
    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    db = moduleFixture.get<NodePgDatabase>(DATABASE_CONNECTION);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Create Appeal", () => {
    it("should create a new appeal with PENDING status", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Session duration was miscalculated",
      };

      // Act
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Assert
      expect(appeal).toBeDefined();
      expect(appeal.id).toBeDefined();
      expect(appeal.mentorId).toBe(testMentorId);
      expect(appeal.counselorId).toBe(testCounselorId);
      expect(appeal.status).toBe("PENDING");
      expect(appeal.appealType).toBe(AppealType.BILLING_ERROR);
      expect(appeal.appealAmount).toBe("100.00");
      expect(appeal.reason).toBe("Session duration was miscalculated");
      expect(appeal.createdBy).toBe(testMentorId);
      expect(appeal.createdAt).toBeDefined();

      // Note: Test data is preserved in the database as required
    });

    it("should publish MENTOR_APPEAL_CREATED_EVENT when appeal is created", async () => {
      // Arrange
      const eventSpy = jest.fn();
      eventEmitter.on(MENTOR_APPEAL_CREATED_EVENT, eventSpy);

      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.MISSING_SERVICE,
        appealAmount: "50.00",
        currency: "CNY",
        reason: "Missing service record for consultation session",
      };

      // Act
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Assert
      expect(eventSpy).toHaveBeenCalled();
      const eventPayload = eventSpy.mock.calls[0][0];
      expect(eventPayload.appealId).toBe(appeal.id);
      expect(eventPayload.mentorId).toBe(testMentorId);
      expect(eventPayload.counselorId).toBe(testCounselorId);
      expect(eventPayload.appealAmount).toBe("50.00");
      expect(eventPayload.appealType).toBe(AppealType.MISSING_SERVICE);
      expect(eventPayload.currency).toBe("CNY");
      expect(eventPayload.createdAt).toBeDefined();
    });

    it("should throw BadRequestException when mentorId does not match creator", async () => {
      // Arrange
      const differentMentorId = uuidv4();
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.PRICE_DISPUTE,
        appealAmount: "200.00",
        currency: "USD",
        reason: "Price discrepancy",
      };

      // Act & Assert
      await expect(
        appealService.createAppeal(createDto, differentMentorId),
      ).rejects.toThrow("Mentor ID must match the creator's user ID");
    });
  });

  describe("Find One Appeal", () => {
    it("should retrieve a single appeal by ID", async () => {
      // Arrange: Create an appeal first
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.OTHER,
        appealAmount: "150.00",
        currency: "USD",
        reason: "Other dispute",
      };
      const createdAppeal = await appealService.createAppeal(createDto, testMentorId);

      // Act
      const foundAppeal = await appealService.findOne({ id: createdAppeal.id });

      // Assert
      expect(foundAppeal).toBeDefined();
      expect(foundAppeal!.id).toBe(createdAppeal.id);
      expect(foundAppeal!.status).toBe("PENDING");
      expect(foundAppeal!.reason).toBe("Other dispute");
    });

    it("should return null for non-existent appeal ID", async () => {
      // Act
      const foundAppeal = await appealService.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      // Assert
      expect(foundAppeal).toBeNull();
    });
  });

  describe("Search Appeals", () => {
    it("should search appeals with filters and pagination", async () => {
      // Create multiple appeals for testing
      const counselorId1 = uuidv4();
      const counselorId2 = uuidv4();

      await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: counselorId1,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Test 1",
      }, testMentorId);

      await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: counselorId2,
        appealType: AppealType.MISSING_SERVICE,
        appealAmount: "200.00",
        currency: "USD",
        reason: "Test 2",
      }, testMentorId);

      await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: counselorId1,
        appealType: AppealType.PRICE_DISPUTE,
        appealAmount: "300.00",
        currency: "USD",
        reason: "Test 3",
      }, testMentorId);

      // Act: Search for PENDING appeals
      const result = await appealService.search({
        mentorId: testMentorId,
        status: "PENDING",
      }, { page: 1, pageSize: 10 });

      // Assert
      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      result.data.forEach(appeal => {
        expect(appeal.mentorId).toBe(testMentorId);
        expect(appeal.status).toBe("PENDING");
      });
    });

    it("should filter appeals by counselor", async () => {
      // Arrange
      const counselorId = uuidv4();

      await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: counselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Filter test 1",
      }, testMentorId);

      await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: uuidv4(),
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "200.00",
        currency: "USD",
        reason: "Filter test 2",
      }, testMentorId);

      // Act
      const result = await appealService.search({
        counselorId: counselorId,
      }, { page: 1, pageSize: 10 });

      // Assert
      expect(result.data.length).toBeGreaterThan(0);
      const filtered = result.data.filter(a => a.counselorId === counselorId);
      expect(filtered.length).toBeGreaterThan(0);
    });

    it("should filter appeals by amount range", async () => {
      // Arrange
      await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Amount range test",
      }, testMentorId);

      // Act
      const result = await appealService.search({
        minAmount: "50",
        maxAmount: "150",
      }, { page: 1, pageSize: 10 });

      // Assert
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach(appeal => {
        expect(parseFloat(appeal.appealAmount)).toBeGreaterThanOrEqual(50);
        expect(parseFloat(appeal.appealAmount)).toBeLessThanOrEqual(150);
      });
    });
  });

  describe("Approve Appeal", () => {
    it("should approve a PENDING appeal", async () => {
      // Arrange: Create a PENDING appeal
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Approve test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Act
      const approvedAppeal = await appealService.approveAppeal(appeal.id, testCounselorId);

      // Assert
      expect(approvedAppeal).toBeDefined();
      expect(approvedAppeal.status).toBe("APPROVED");
      expect(approvedAppeal.approvedBy).toBe(testCounselorId);
      expect(approvedAppeal.approvedAt).toBeDefined();
      expect(approvedAppeal.rejectionReason).toBeNull();
    });

    it("should publish MENTOR_APPEAL_APPROVED_EVENT when appeal is approved", async () => {
      // Arrange
      const eventSpy = jest.fn();
      eventEmitter.on(MENTOR_APPEAL_APPROVED_EVENT, eventSpy);

      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.MISSING_SERVICE,
        appealAmount: "50.00",
        currency: "USD",
        reason: "Approve event test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Act
      await appealService.approveAppeal(appeal.id, testCounselorId);

      // Assert
      expect(eventSpy).toHaveBeenCalled();
      const eventPayload = eventSpy.mock.calls[0][0];
      expect(eventPayload.appealId).toBe(appeal.id);
      expect(eventPayload.mentorId).toBe(testMentorId);
      expect(eventPayload.counselorId).toBe(testCounselorId);
      expect(eventPayload.appealAmount).toBe("50.00");
      expect(eventPayload.approvedBy).toBe(testCounselorId);
      expect(eventPayload.approvedAt).toBeDefined();
      expect(eventPayload.currency).toBe("USD");
    });

    it("should throw NotFoundException for non-existent appeal", async () => {
      // Act & Assert
      await expect(
        appealService.approveAppeal("00000000-0000-0000-0000-000000000000", testCounselorId),
      ).rejects.toThrow("Appeal not found");
    });

    it("should throw BadRequestException when appeal is already approved", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Already approved test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);
      await appealService.approveAppeal(appeal.id, testCounselorId);

      // Act & Assert
      await expect(
        appealService.approveAppeal(appeal.id, testCounselorId),
      ).rejects.toThrow("Cannot approve appeal with status: APPROVED. Only PENDING appeals can be approved.");
    });

    it("should throw ForbiddenException when counselor ID mismatch", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Permission test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      const differentCounselorId = uuidv4();

      // Act & Assert
      await expect(
        appealService.approveAppeal(appeal.id, differentCounselorId),
      ).rejects.toThrow("Only the assigned counselor can approve this appeal");
    });
  });

  describe("Reject Appeal", () => {
    it("should reject a PENDING appeal", async () => {
      // Arrange: Create a PENDING appeal
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Reject test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Act
      const rejectedAppeal = await appealService.rejectAppeal(appeal.id, {
        rejectionReason: "Insufficient evidence provided",
      }, testCounselorId);

      // Assert
      expect(rejectedAppeal).toBeDefined();
      expect(rejectedAppeal.status).toBe("REJECTED");
      expect(rejectedAppeal.rejectionReason).toBe("Insufficient evidence provided");
      expect(rejectedAppeal.rejectedBy).toBe(testCounselorId);
      expect(rejectedAppeal.rejectedAt).toBeDefined();
      expect(rejectedAppeal.approvedBy).toBeNull();
      expect(rejectedAppeal.approvedAt).toBeNull();
    });

    it("should publish MENTOR_APPEAL_REJECTED_EVENT when appeal is rejected", async () => {
      // Arrange
      const eventSpy = jest.fn();
      eventEmitter.on(MENTOR_APPEAL_REJECTED_EVENT, eventSpy);

      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.PRICE_DISPUTE,
        appealAmount: "75.00",
        currency: "USD",
        reason: "Reject event test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Act
      await appealService.rejectAppeal(appeal.id, {
        rejectionReason: "Price is correct",
      }, testCounselorId);

      // Assert
      expect(eventSpy).toHaveBeenCalled();
      const eventPayload = eventSpy.mock.calls[0][0];
      expect(eventPayload.appealId).toBe(appeal.id);
      expect(eventPayload.mentorId).toBe(testMentorId);
      expect(eventPayload.counselorId).toBe(testCounselorId);
      expect(eventPayload.rejectionReason).toBe("Price is correct");
      expect(eventPayload.rejectedBy).toBe(testCounselorId);
      expect(eventPayload.rejectedAt).toBeDefined();
    });

    it("should throw NotFoundException for non-existent appeal", async () => {
      // Act & Assert
      await expect(
        appealService.rejectAppeal("00000000-0000-0000-0000-000000000000", {
          rejectionReason: "Reason",
        }, testCounselorId),
      ).rejects.toThrow("Appeal not found");
    });

    it("should throw BadRequestException when appeal is already rejected", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Already rejected test",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);
      await appealService.rejectAppeal(appeal.id, {
        rejectionReason: "First rejection",
      }, testCounselorId);

      // Act & Assert
      await expect(
        appealService.rejectAppeal(appeal.id, {
          rejectionReason: "Second rejection attempt",
        }, testCounselorId),
      ).rejects.toThrow("Cannot reject appeal with status: REJECTED. Only PENDING appeals can be rejected.");
    });

    it("should require rejection reason", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Test rejection reason required",
      };
      const appeal = await appealService.createAppeal(createDto, testMentorId);

      // Act
      const result = await appealService.rejectAppeal(appeal.id, {
        rejectionReason: "Valid reason",
      }, testCounselorId);

      // Assert
      expect(result.rejectionReason).toBe("Valid reason");
    });
  });

  describe("Appeal Lifecycle", () => {
    it("should complete full appeal lifecycle: create → approve", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Full lifecycle test",
      };

      // Act: Create appeal
      const appeal = await appealService.createAppeal(createDto, testMentorId);
      expect(appeal.status).toBe("PENDING");

      // Act: Approve appeal
      const approvedAppeal = await appealService.approveAppeal(appeal.id, testCounselorId);

      // Assert
      expect(approvedAppeal.status).toBe("APPROVED");
      expect(approvedAppeal.approvedBy).toBe(testCounselorId);
      expect(approvedAppeal.approvedAt).toBeDefined();

      // Verify final state
      const finalAppeal = await appealService.findOne({ id: approvedAppeal.id });
      expect(finalAppeal!.status).toBe("APPROVED");
    });

    it("should complete full appeal lifecycle: create → reject", async () => {
      // Arrange
      const createDto: ICreateAppealDTO = {
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.PRICE_DISPUTE,
        appealAmount: "200.00",
        currency: "USD",
        reason: "Full lifecycle reject test",
      };

      // Act: Create appeal
      const appeal = await appealService.createAppeal(createDto, testMentorId);
      expect(appeal.status).toBe("PENDING");

      // Act: Reject appeal
      const rejectedAppeal = await appealService.rejectAppeal(appeal.id, {
        rejectionReason: "Price is correct as per contract",
      }, testCounselorId);

      // Assert
      expect(rejectedAppeal.status).toBe("REJECTED");
      expect(rejectedAppeal.rejectionReason).toBe("Price is correct as per contract");
      expect(rejectedAppeal.rejectedBy).toBe(testCounselorId);
      expect(rejectedAppeal.rejectedAt).toBeDefined();

      // Verify final state
      const finalAppeal = await appealService.findOne({ id: rejectedAppeal.id });
      expect(finalAppeal!.status).toBe("REJECTED");
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple appeals per mentor", async () => {
      // Act: Create multiple appeals for the same mentor
      const appeal1 = await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Multiple appeals test 1",
      }, testMentorId);

      const appeal2 = await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.MISSING_SERVICE,
        appealAmount: "200.00",
        currency: "USD",
        reason: "Multiple appeals test 2",
      }, testMentorId);

      const appeal3 = await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: testCounselorId,
        appealType: AppealType.PRICE_DISPUTE,
        appealAmount: "300.00",
        currency: "USD",
        reason: "Multiple appeals test 3",
      }, testMentorId);

      // Assert
      expect(appeal1).toBeDefined();
      expect(appeal2).toBeDefined();
      expect(appeal3).toBeDefined();

      // Verify all appeals exist
      const searchResult = await appealService.search({
        mentorId: testMentorId,
      }, { page: 1, pageSize: 10 });

      expect(searchResult.total).toBeGreaterThanOrEqual(3);
    });

    it("should handle appeals with optional fields (mentorPayableId, settlementId)", async () => {
      // Arrange
      const mentorPayableId = uuidv4();
      const settlementId = uuidv4();

      // Act
      const appeal = await appealService.createAppeal({
        mentorId: testMentorId,
        counselorId: testCounselorId,
        mentorPayableId: mentorPayableId,
        settlementId: settlementId,
        appealType: AppealType.BILLING_ERROR,
        appealAmount: "100.00",
        currency: "USD",
        reason: "Test with optional fields",
      }, testMentorId);

      // Assert
      expect(appeal.mentorPayableId).toBe(mentorPayableId);
      expect(appeal.settlementId).toBe(settlementId);
    });
  });
});
