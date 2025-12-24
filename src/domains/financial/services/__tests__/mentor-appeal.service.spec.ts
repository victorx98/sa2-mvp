import { Test, TestingModule } from "@nestjs/testing";
import { MentorAppealService } from "./mentor-appeal.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { mentorAppeals } from "@infrastructure/database/schema";
import {
  IntegrationEventPublisher,
  MentorAppealApprovedEvent,
  MentorAppealCreatedEvent,
  MentorAppealRejectedEvent,
} from "@application/events";
import {
  IAppealSearchDTO,
  ICreateAppealDTO,
} from "@domains/financial/interfaces/mentor-appeal.interface";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";
import { eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";

// Mock the schema module
jest.mock("@infrastructure/database/schema/mentor-appeals.schema", () => ({
  MentorAppealSchema: {
    mentorAppeals: {},
  },
}));

// Mock the schema module
jest.mock("@infrastructure/database/schema", () => ({
  mentorAppeals: {
    id: "id",
    mentorId: "mentorId",
    counselorId: "counselorId",
    studentId: "studentId",
    mentorPayableId: "mentorPayableId",
    settlementId: "settlementId",
    appealType: "appealType",
    appealAmount: "appealAmount",
    currency: "currency",
    reason: "reason",
    status: "status",
    approvedBy: "approvedBy",
    approvedAt: "approvedAt",
    rejectionReason: "rejectionReason",
    rejectedBy: "rejectedBy",
    rejectedAt: "rejectedAt",
    createdBy: "createdBy",
    createdAt: "createdAt",
    comments: "comments",
  },
}));

// Mock the database helper
// jest.mock('@infrastructure/database/test-database.helper');

describe("MentorAppealService", () => {
  let service: MentorAppealService;
  let _mockDb: any;
  let _mockEventPublisher: { publish: jest.Mock };

  beforeEach(async () => {
    // Create mock database
    _mockDb = {
      query: {
        mentorAppeals: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };

    // Create mock event publisher
    _mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorAppealService,
        {
          provide: DATABASE_CONNECTION,
          useValue: _mockDb,
        },
        {
          provide: IntegrationEventPublisher,
          useValue: _mockEventPublisher,
        },
      ],
    }).compile();

    service = module.get<MentorAppealService>(MentorAppealService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createAppeal", () => {
    it("should create an appeal successfully", async () => {
      // Arrange
      const createAppealDto: ICreateAppealDTO = {
        mentorId: "550e8400-e29b-41d4-a716-446655440001",
        counselorId: "550e8400-e29b-41d4-a716-446655440002",
        studentId: "550e8400-e29b-41d4-a716-446655440006",
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        mentorPayableId: "550e8400-e29b-41d4-a716-446655440003",
        settlementId: "550e8400-e29b-41d4-a716-446655440004",
      };

      const userId = "550e8400-e29b-41d4-a716-446655440001"; // Must match mentorId
      const expectedAppealId = "550e8400-e29b-41d4-a716-446655440005";

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: expectedAppealId,
            ...createAppealDto,
            status: "PENDING",
            createdAt: new Date(),
            createdBy: userId,
          },
        ]),
      };

      _mockDb.insert.mockReturnValue(mockInsert);

      // Act
      const result = await service.createAppeal(createAppealDto, userId);

      // Assert
      expect(_mockDb.insert).toHaveBeenCalledWith(mentorAppeals);
      expect(mockInsert.values).toHaveBeenCalledWith({
        ...createAppealDto,
        status: "PENDING",
        createdBy: userId,
      });
      expect(mockInsert.returning).toHaveBeenCalled();
      expect(_mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            appealId: expectedAppealId,
            mentorId: createAppealDto.mentorId,
            appealType: createAppealDto.appealType,
            appealAmount: createAppealDto.appealAmount,
          }),
        }),
        MentorAppealService.name,
      );
      expect(result).toEqual({
        id: expectedAppealId,
        ...createAppealDto,
        status: "PENDING",
        createdAt: expect.any(Date),
        createdBy: userId,
      });
    });

    it("should throw an error when mentorId does not match createdByUserId", async () => {
      // Arrange
      const createAppealDto: ICreateAppealDTO = {
        mentorId: "550e8400-e29b-41d4-a716-446655440001",
        counselorId: "550e8400-e29b-41d4-a716-446655440002",
        studentId: "550e8400-e29b-41d4-a716-446655440006",
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
      };

      const userId = "550e8400-e29b-41d4-a716-446655440099"; // Does not match mentorId

      // Act & Assert
      await expect(
        service.createAppeal(createAppealDto, userId),
      ).rejects.toThrow("Mentor ID must match the creator's user ID");
      expect(_mockDb.insert).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should throw an error when database operation fails", async () => {
      // Arrange
      const createAppealDto: ICreateAppealDTO = {
        mentorId: "550e8400-e29b-41d4-a716-446655440001",
        counselorId: "550e8400-e29b-41d4-a716-446655440002",
        studentId: "550e8400-e29b-41d4-a716-446655440006",
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
      };

      const userId = "550e8400-e29b-41d4-a716-446655440001"; // Matches mentorId
      const errorMessage = "Database error";

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockRejectedValue(new Error(errorMessage)),
      };

      _mockDb.insert.mockReturnValue(mockInsert);

      // Act & Assert
      await expect(
        service.createAppeal(createAppealDto, userId),
      ).rejects.toThrow(errorMessage);
      expect(_mockDb.insert).toHaveBeenCalledWith(mentorAppeals);
      expect(mockInsert.values).toHaveBeenCalledWith({
        ...createAppealDto,
        status: "PENDING",
        createdBy: userId,
      });
      expect(mockInsert.returning).toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find an appeal by ID successfully", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440002",
        counselorId: "550e8400-e29b-41d4-a716-446655440003",
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act
      const result = await service.findOne({ id: appealId });

      // Assert
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: eq(schema.mentorAppeals.id, appealId),
      });
      expect(result).toEqual(expectedAppeal);
    });

    it("should find an appeal by conditions successfully", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440002";

      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440001",
        counselorId: "550e8400-e29b-41d4-a716-446655440003",
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act
      const result = await service.findOne({ id: appealId });

      // Assert
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: eq(schema.mentorAppeals.id, appealId),
      });
      expect(result).toEqual(expectedAppeal);
    });

    it("should return null when appeal is not found", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440099";

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      _mockDb.query = mockQuery;

      // Act
      const result = await service.findOne({ id: appealId });

      // Assert
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: eq(schema.mentorAppeals.id, appealId),
      });
      expect(result).toBeNull();
    });

    it("should throw an error when database operation fails", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const errorMessage = "Database error";

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockRejectedValue(new Error(errorMessage)),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(service.findOne({ id: appealId })).rejects.toThrow(
        errorMessage,
      );
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });
  });

  describe("search", () => {
    it("should search appeals successfully", async () => {
      // Arrange
      const searchDto: IAppealSearchDTO = {
        mentorId: "550e8400-e29b-41d4-a716-446655440001",
        status: "PENDING",
      };

      const pagination: IPaginationQuery = {
        page: 1,
        pageSize: 10,
      };

      const sort: ISortQuery = {
        field: "createdAt",
        direction: "desc",
      };

      const expectedAppeals = [
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          mentorId: "550e8400-e29b-41d4-a716-446655440001",
          counselorId: "550e8400-e29b-41d4-a716-446655440003",
          appealType: "billing_error",
          appealAmount: "100.00",
          currency: "USD",
          reason: "Billing calculation error",
          status: "PENDING",
          createdAt: new Date(),
          createdBy: "550e8400-e29b-41d4-a716-446655440004",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440005",
          mentorId: "550e8400-e29b-41d4-a716-446655440001",
          counselorId: "550e8400-e29b-41d4-a716-446655440003",
          appealType: "payment_issue",
          appealAmount: "50.00",
          currency: "USD",
          reason: "Payment processing issue",
          status: "PENDING",
          createdAt: new Date(),
          createdBy: "550e8400-e29b-41d4-a716-446655440004",
        },
      ];

      const expectedTotal = 2;

      const mockQuery = {
        mentorAppeals: {
          findMany: jest.fn().mockResolvedValue(expectedAppeals),
        },
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]), // Mock count result
      };

      _mockDb.query = mockQuery;
      _mockDb.select = jest.fn().mockReturnValue(mockSelect);

      // Act
      const result = await service.search(searchDto, pagination, sort);

      // Assert
      expect(_mockDb.query.mentorAppeals.findMany).toHaveBeenCalled();
      expect(result).toEqual({
        data: expectedAppeals,
        total: expectedTotal,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(expectedTotal / pagination.pageSize),
      });
    });

    it("should search appeals without filters", async () => {
      // Arrange
      const searchDto: IAppealSearchDTO = {};

      const pagination: IPaginationQuery = {
        page: 2,
        pageSize: 20,
      };

      const sort: ISortQuery = {
        field: "status",
        direction: "asc",
      };

      const expectedAppeals = [
        {
          id: "550e8400-e29b-41d4-a716-446655440006",
          mentorId: "550e8400-e29b-41d4-a716-446655440007",
          counselorId: "550e8400-e29b-41d4-a716-446655440008",
          appealType: "billing_error",
          appealAmount: "75.00",
          currency: "USD",
          reason: "Another billing error",
          status: "APPROVED",
          createdAt: new Date(),
          createdBy: "550e8400-e29b-41d4-a716-446655440009",
        },
      ];

      const expectedTotal = 1;

      const mockQuery = {
        mentorAppeals: {
          findMany: jest.fn().mockResolvedValue(expectedAppeals),
        },
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: "1" }]), // Mock count result
      };

      _mockDb.query = mockQuery;
      _mockDb.select = jest.fn().mockReturnValue(mockSelect);

      // Act
      const result = await service.search(searchDto, pagination, sort);

      // Assert
      expect(_mockDb.query.mentorAppeals.findMany).toHaveBeenCalled();
      expect(result).toEqual({
        data: expectedAppeals,
        total: expectedTotal,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(expectedTotal / pagination.pageSize),
      });
    });

    it("should throw an error when database operation fails", async () => {
      // Arrange
      const searchDto: IAppealSearchDTO = {
        mentorId: "550e8400-e29b-41d4-a716-446655440001",
      };

      const pagination: IPaginationQuery = {
        page: 1,
        pageSize: 10,
      };

      const sort: ISortQuery = {
        field: "createdAt",
        direction: "desc",
      };

      const errorMessage = "Database error";

      const mockQuery = {
        mentorAppeals: {
          findMany: jest.fn().mockRejectedValue(new Error(errorMessage)),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(service.search(searchDto, pagination, sort)).rejects.toThrow(
        errorMessage,
      );
      expect(_mockDb.query.mentorAppeals.findMany).toHaveBeenCalledWith({
        where: expect.anything(),
        orderBy: expect.anything(),
        limit: pagination.pageSize,
        offset: 0,
      });
    });
  });

  describe("approveAppeal", () => {
    it("should approve an appeal successfully", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: approvedByUserId, // Must match the approver
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const updatedAppeal = {
        ...expectedAppeal,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: approvedByUserId,
      };

      // Mock findOne to return the appeal
      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Mock update
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedAppeal]),
      };

      _mockDb.update = jest.fn().mockReturnValue(mockUpdate);

      // Act
      const result = await service.approveAppeal(appealId, approvedByUserId);

      // Assert
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
      expect(_mockDb.update).toHaveBeenCalledWith(mentorAppeals);
      expect(mockUpdate.set).toHaveBeenCalledWith({
        status: "APPROVED",
        approvedAt: expect.any(Date),
        approvedBy: approvedByUserId,
        appealAmount: expectedAppeal.appealAmount, // Service always updates all fields
        currency: expectedAppeal.currency,
        comments: undefined,
        rejectionReason: undefined,
        rejectedBy: undefined,
        rejectedAt: undefined,
      });
      expect(mockUpdate.where).toHaveBeenCalled();
      expect(mockUpdate.returning).toHaveBeenCalled();
      expect(_mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            appealId,
            mentorId: expectedAppeal.mentorId,
            counselorId: expectedAppeal.counselorId,
            appealAmount: expectedAppeal.appealAmount,
            approvedBy: approvedByUserId,
          }),
        }),
        MentorAppealService.name,
      );
      expect(result).toEqual(updatedAppeal);
    });

    it("should throw an error when appeal is not found", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440099";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.approveAppeal(appealId, approvedByUserId),
      ).rejects.toThrow("Appeal not found");
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should throw an error when appeal is not in PENDING status", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: approvedByUserId, // Must match the approver
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        status: "APPROVED", // Already approved
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.approveAppeal(appealId, approvedByUserId),
      ).rejects.toThrow(
        "Cannot approve appeal with status: APPROVED. Only PENDING appeals can be approved.",
      );
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should approve an appeal with invalid original amount by providing new appealAmount and currency", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: approvedByUserId, // Must match the approver
        appealType: "billing_error",
        appealAmount: "0", // Invalid original amount
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const newAppealAmount = 200.5;
      const newCurrency = "EUR";
      const comments = "Updated appeal amount due to calculation error";

      const updatedAppeal = {
        ...expectedAppeal,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: approvedByUserId,
        appealAmount: newAppealAmount.toString(),
        currency: newCurrency,
        comments,
      };

      // Mock findOne to return the appeal
      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Mock update
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedAppeal]),
      };

      _mockDb.update = jest.fn().mockReturnValue(mockUpdate);

      // Act
      const result = await service.approveAppeal(
        appealId, 
        approvedByUserId, 
        newAppealAmount, 
        newCurrency, 
        comments
      );

      // Assert
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
      expect(_mockDb.update).toHaveBeenCalledWith(mentorAppeals);
      expect(mockUpdate.set).toHaveBeenCalledWith({
        status: "APPROVED",
        approvedAt: expect.any(Date),
        approvedBy: approvedByUserId,
        appealAmount: newAppealAmount.toString(),
        currency: newCurrency,
        comments,
        rejectionReason: undefined,
        rejectedBy: undefined,
        rejectedAt: undefined,
      });
      expect(mockUpdate.where).toHaveBeenCalled();
      expect(mockUpdate.returning).toHaveBeenCalled();
      expect(_mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            appealId,
            mentorId: expectedAppeal.mentorId,
            counselorId: expectedAppeal.counselorId,
            appealAmount: newAppealAmount.toString(),
            approvedBy: approvedByUserId,
            currency: newCurrency,
          }),
        }),
        MentorAppealService.name,
      );
      expect(result).toEqual(updatedAppeal);
    });

    it("should throw an error when original amount is invalid and appealAmount is missing", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: approvedByUserId, // Must match the approver
        appealType: "billing_error",
        appealAmount: "", // Invalid original amount
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      // Mock findOne to return the appeal
      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.approveAppeal(appealId, approvedByUserId),
      ).rejects.toThrow(
        "appealAmount is required when original appeal amount is invalid",
      );
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should throw an error when original amount is invalid and currency is missing", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: approvedByUserId, // Must match the approver
        appealType: "billing_error",
        appealAmount: "0", // Invalid original amount
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const newAppealAmount = 200.5;

      // Mock findOne to return the appeal
      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.approveAppeal(appealId, approvedByUserId, newAppealAmount),
      ).rejects.toThrow(
        "currency is required when original appeal amount is invalid",
      );
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should throw an error when original amount is invalid and currency format is invalid", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const approvedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: approvedByUserId, // Must match the approver
        appealType: "billing_error",
        appealAmount: "0", // Invalid original amount
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const newAppealAmount = 200.5;
      const invalidCurrency = "EURO"; // Invalid currency format

      // Mock findOne to return the appeal
      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.approveAppeal(appealId, approvedByUserId, newAppealAmount, invalidCurrency),
      ).rejects.toThrow(
        "currency must be a valid ISO 4217 3-letter code",
      );
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("rejectAppeal", () => {
    it("should reject an appeal successfully", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const rejectDto = {
        rejectionReason: "Invalid claim",
      };
      const rejectedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: rejectedByUserId, // Must match the rejector
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        status: "PENDING",
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const updatedAppeal = {
        ...expectedAppeal,
        status: "REJECTED",
        rejectionReason: rejectDto.rejectionReason,
        rejectedAt: new Date(),
        rejectedBy: rejectedByUserId,
      };

      // Mock findOne to return the appeal
      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Mock update
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedAppeal]),
      };

      _mockDb.update = jest.fn().mockReturnValue(mockUpdate);

      // Act
      const result = await service.rejectAppeal(
        appealId,
        rejectDto,
        rejectedByUserId,
      );

      // Assert
      expect(_mockDb.query.mentorAppeals.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
      expect(_mockDb.update).toHaveBeenCalledWith(mentorAppeals);
      expect(mockUpdate.set).toHaveBeenCalledWith({
        status: "REJECTED",
        rejectionReason: rejectDto.rejectionReason,
        rejectedAt: expect.any(Date),
        rejectedBy: rejectedByUserId,
      });
      expect(mockUpdate.where).toHaveBeenCalled();
      expect(mockUpdate.returning).toHaveBeenCalled();
      expect(_mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            appealId,
            mentorId: expectedAppeal.mentorId,
            counselorId: expectedAppeal.counselorId,
            rejectedBy: rejectedByUserId,
          }),
        }),
        MentorAppealService.name,
      );
      expect(result).toEqual(updatedAppeal);
    });

    it("should throw an error when appeal is not found", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440099";
      const rejectDto = {
        rejectionReason: "Invalid claim",
      };
      const rejectedByUserId = "550e8400-e29b-41d4-a716-446655440002";

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.rejectAppeal(appealId, rejectDto, rejectedByUserId),
      ).rejects.toThrow("Appeal not found");
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should throw an error when appeal is not in PENDING status", async () => {
      // Arrange
      const appealId = "550e8400-e29b-41d4-a716-446655440001";
      const rejectDto = {
        rejectionReason: "Invalid claim",
      };
      const rejectedByUserId = "550e8400-e29b-41d4-a716-446655440002";
      const expectedAppeal = {
        id: appealId,
        mentorId: "550e8400-e29b-41d4-a716-446655440003",
        counselorId: rejectedByUserId, // Must match the rejector
        appealType: "billing_error",
        appealAmount: "100.00",
        currency: "USD",
        reason: "Billing calculation error",
        status: "REJECTED", // Already rejected
        createdAt: new Date(),
        createdBy: "550e8400-e29b-41d4-a716-446655440004",
      };

      const mockQuery = {
        mentorAppeals: {
          findFirst: jest.fn().mockResolvedValue(expectedAppeal),
        },
      };

      _mockDb.query = mockQuery;

      // Act & Assert
      await expect(
        service.rejectAppeal(appealId, rejectDto, rejectedByUserId),
      ).rejects.toThrow(
        "Cannot reject appeal with status: REJECTED. Only PENDING appeals can be rejected.",
      );
      expect(_mockDb.update).not.toHaveBeenCalled();
      expect(_mockEventPublisher.publish).not.toHaveBeenCalled();
    });
  });
});
