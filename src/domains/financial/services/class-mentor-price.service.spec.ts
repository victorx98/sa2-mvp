/**
 * Class Mentor Price Service Test
 *
 * This file contains unit tests for the ClassMentorPriceService
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ClassMentorPriceService } from "./class-mentor-price.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { CreateClassMentorPriceDto } from "../dto/create-class-mentor-price.dto";
import { UpdateClassMentorPriceDto } from "../dto/update-class-mentor-price.dto";
import { FinancialException } from "../common/exceptions/financial.exception";

// Mock database connection
let mockDb: any;
let chainableUpdateMock: any;

// Mock logger
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe("ClassMentorPriceService", () => {
  let service: ClassMentorPriceService;
  
  beforeEach(async () => {
    // Initialize mock database
    const chainableSelectMock = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue([{ count: 0 }]),
      execute: jest.fn().mockResolvedValue([{ count: 0 }]),
    };
    
    chainableUpdateMock = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{}]),
    };
    
    mockDb = {
      query: {
        classMentorsPrices: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn().mockReturnValue(chainableSelectMock),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnValue(chainableUpdateMock),
      returning: jest.fn(),
      values: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };
    
    const moduleBuilder = Test.createTestingModule({
      imports: [],
      providers: [
        ClassMentorPriceService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    });
    const compiledModule = await moduleBuilder.compile();
    
    service = compiledModule.get<ClassMentorPriceService>(ClassMentorPriceService);
    // Replace logger with mock
    (service as any).logger = mockLogger;
  });
  
  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe("createClassMentorPrice", () => {
    it("should create a new class mentor price record", async () => {
      // Arrange
      const dto: CreateClassMentorPriceDto = {
        classId: "123e4567-e89b-12d3-a456-426614174000",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174001",
        pricePerSession: 100.50, // Number in DTO
      };
      
      const mockCreatedPrice = {
        id: "123e4567-e89b-12d3-a456-426614174002",
        classId: dto.classId,
        mentorUserId: dto.mentorUserId,
        pricePerSession: dto.pricePerSession.toString(), // Database returns string (decimal type)
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any; // Type assertion because database returns string but DTO uses number
      
      // Mock the database calls
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(null);
      (mockDb.returning as jest.Mock).mockResolvedValue([mockCreatedPrice]);
      
      // Act
      const result = await service.createClassMentorPrice(dto);
      
      // Assert
      expect(result).toEqual(mockCreatedPrice);
      expect(mockDb.insert).toHaveBeenCalledWith(schema.classMentorsPrices);
      expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
        classId: dto.classId,
        mentorUserId: dto.mentorUserId,
        pricePerSession: dto.pricePerSession.toString(), // Service converts to string
        status: "active",
      }));
      expect(mockLogger.log).toHaveBeenCalled();
    });
    
    it("should throw an error if class mentor price already exists", async () => {
      // Arrange
      const dto: CreateClassMentorPriceDto = {
        classId: "123e4567-e89b-12d3-a456-426614174000",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174001",
        pricePerSession: 100.50, // Number in DTO
      };
      
      // Mock the database call to return an existing price
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174002",
        classId: dto.classId,
        mentorUserId: dto.mentorUserId,
        pricePerSession: dto.pricePerSession.toString(), // Database returns string (decimal type)
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any); // Type assertion because database returns string but DTO uses number
      
      // Act & Assert
      await expect(service.createClassMentorPrice(dto)).rejects.toThrow(FinancialException);
      // Note: FinancialConflictException is a FinancialException, so error logging may occur
    });
  });
  
  describe("updateClassMentorPrice", () => {
    it("should update an existing class mentor price record", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const dto: UpdateClassMentorPriceDto = {
        pricePerSession: 150.75, // Number in DTO
      };
      
      const existingPrice = {
        id,
        classId: "123e4567-e89b-12d3-a456-426614174001",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174002",
        pricePerSession: "100.50", // String to match database schema
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const updatedPrice = {
        ...existingPrice,
        pricePerSession: dto.pricePerSession.toString(), // Convert to string to match schema
        updatedAt: new Date(),
      };
      
      // Mock the database calls
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(existingPrice);
      (chainableUpdateMock.returning as jest.Mock).mockResolvedValue([updatedPrice]);
      
      // Act
      const result = await service.updateClassMentorPrice(id, dto);
      
      // Assert
      expect(result).toEqual(updatedPrice);
      expect(mockDb.update).toHaveBeenCalledWith(schema.classMentorsPrices);
      expect(chainableUpdateMock.set).toHaveBeenCalledWith(expect.objectContaining({
        pricePerSession: dto.pricePerSession.toString(), // Service converts to string
      }));
      expect(chainableUpdateMock.where).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });
    
    it("should throw an error if class mentor price not found", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const dto: UpdateClassMentorPriceDto = {
        pricePerSession: 150.75, // Number in DTO
      };
      
      // Mock the database call to return null
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Act & Assert
      await expect(service.updateClassMentorPrice(id, dto)).rejects.toThrow(FinancialException);
    });
  });
  
  describe("updateStatus", () => {
    it("should update class mentor price status to deleted", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const status = "deleted";
      
      const existingPrice = {
        id,
        classId: "123e4567-e89b-12d3-a456-426614174001",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174002",
        pricePerSession: "100.50", // String to match database schema
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const updatedPrice = {
        ...existingPrice,
        status: "deleted",
        updatedAt: new Date(),
      };
      
      // Mock the database calls
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(existingPrice);
      (chainableUpdateMock.returning as jest.Mock).mockResolvedValue([updatedPrice]);
      
      // Act
      const result = await service.updateStatus(id, status);
      
      // Assert
      expect(result).toEqual(updatedPrice);
      expect(mockDb.update).toHaveBeenCalledWith(schema.classMentorsPrices);
      expect(chainableUpdateMock.set).toHaveBeenCalledWith(expect.objectContaining({
        status: "deleted",
      }));
      expect(mockLogger.log).toHaveBeenCalled();
    });
    
    it("should update class mentor price status to active", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const status = "active";
      
      const existingPrice = {
        id,
        classId: "123e4567-e89b-12d3-a456-426614174001",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174002",
        pricePerSession: "100.50", // String to match database schema
        status: "deleted",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const updatedPrice = {
        ...existingPrice,
        status: "active",
        updatedAt: new Date(),
      };
      
      // Mock the database calls
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingPrice) // First call: check if exists
        .mockResolvedValueOnce(null); // Second call: check if active price exists
      (chainableUpdateMock.returning as jest.Mock).mockResolvedValue([updatedPrice]);
      
      // Act
      const result = await service.updateStatus(id, status);
      
      // Assert
      expect(result).toEqual(updatedPrice);
      expect(mockDb.update).toHaveBeenCalledWith(schema.classMentorsPrices);
      expect(chainableUpdateMock.set).toHaveBeenCalledWith(expect.objectContaining({
        status: "active",
      }));
      expect(mockLogger.log).toHaveBeenCalled();
    });
    
    it("should throw an error if class mentor price not found", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const status = "deleted";
      
      // Mock the database call to return null
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Act & Assert
      await expect(service.updateStatus(id, status)).rejects.toThrow(FinancialException);
    });
    
    it("should throw an error if active price already exists when restoring", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const status = "active";
      
      const existingPrice = {
        id,
        classId: "123e4567-e89b-12d3-a456-426614174001",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174002",
        pricePerSession: "100.50", // String to match database schema
        status: "deleted",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const activePrice = {
        id: "123e4567-e89b-12d3-a456-426614174003",
        classId: existingPrice.classId,
        mentorUserId: existingPrice.mentorUserId,
        pricePerSession: "150.75", // String to match database schema
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Mock the database calls
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingPrice) // First call: check if exists
        .mockResolvedValueOnce(activePrice); // Second call: check if active price exists
      
      // Act & Assert
      await expect(service.updateStatus(id, status)).rejects.toThrow(FinancialException);
    });
    
    it("should return the existing price if status is already the same", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const status = "active";
      
      const existingPrice = {
        id,
        classId: "123e4567-e89b-12d3-a456-426614174001",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174002",
        pricePerSession: "100.50", // String to match database schema
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Mock the database call
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(existingPrice);
      
      // Act
      const result = await service.updateStatus(id, status);
      
      // Assert
      expect(result).toEqual(existingPrice);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
  
  describe("findOne", () => {
    it("should return a class mentor price record by ID", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      
      const expectedPrice = {
        id,
        classId: "123e4567-e89b-12d3-a456-426614174001",
        mentorUserId: "123e4567-e89b-12d3-a456-426614174002",
        pricePerSession: "100.50", // String to match database schema
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Mock the database call
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(expectedPrice);
      
      // Act
      const result = await service.findOne({ id });
      
      // Assert
      expect(result).toEqual(expectedPrice);
      expect(mockDb.query.classMentorsPrices.findFirst).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should return a class mentor price record by class ID and mentor user ID", async () => {
      // Arrange
      const classId = "123e4567-e89b-12d3-a456-426614174001";
      const mentorUserId = "123e4567-e89b-12d3-a456-426614174002";
      
      const expectedPrice = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        classId,
        mentorUserId,
        pricePerSession: "100.50", // String to match database schema
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Mock the database call
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(expectedPrice);
      
      // Act
      const result = await service.findOne({ classId, mentorUserId });
      
      // Assert
      expect(result).toEqual(expectedPrice);
      expect(mockDb.query.classMentorsPrices.findFirst).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should return null when no criteria provided", async () => {
      // Act
      const result = await service.findOne({});
      
      // Assert
      expect(result).toBeNull();
      expect(mockDb.query.classMentorsPrices.findFirst).not.toHaveBeenCalled();
    });

    it("should return null when record not found", async () => {
      // Arrange
      const id = "123e4567-e89b-12d3-a456-426614174000";
      
      // Mock the database call to return null
      (mockDb.query.classMentorsPrices.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Act
      const result = await service.findOne({ id });
      
      // Assert
      expect(result).toBeNull();
      expect(mockDb.query.classMentorsPrices.findFirst).toHaveBeenCalledWith(expect.any(Object));
    });
  });
});
