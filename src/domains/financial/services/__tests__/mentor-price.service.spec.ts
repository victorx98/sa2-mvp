import { Test, TestingModule } from "@nestjs/testing";
import { MentorPriceService } from "./mentor-price.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { CreateMentorPriceRequestDto } from "@api/dto/request/financial/mentor-price.request.dto";
import { UpdateMentorPriceRequestDto } from "@api/dto/request/financial/mentor-price.request.dto";
import {
  FinancialException
} from "../common/exceptions/financial.exception";

/**
 * Mentor Price Service Unit Tests(导师价格服务单元测试)
 *
 * Test coverage for all mentor price management operations(测试所有导师价格管理操作的覆盖率)
 */
describe("MentorPriceService", () => {
  let service: MentorPriceService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock database connection (模拟数据库连接)
    mockDb = {
      query: {
        mentorPrices: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([{ count: 0 }]),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{}]),
      transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockDb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorPriceService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<MentorPriceService>(MentorPriceService);
  });

  describe("getMentorPrice", () => {
    it("should return mentor price when found", async () => {
      // Arrange
      const mentorUserId = "mentor-123";
      const sessionTypeCode = "consultation";
      const mockPrice = {
        id: "price-123",
        mentorUserId,
        sessionTypeCode,
        price: 100,
        currency: "USD",
        status: "active",
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(mockPrice);

      // Act
      const result = await service.getMentorPrice(mentorUserId, sessionTypeCode);

      // Assert
      expect(result).toEqual(mockPrice);
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });

    it("should return null when mentor price not found", async () => {
      // Arrange
      const mentorUserId = "mentor-123";
      const sessionTypeCode = "consultation";

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getMentorPrice(mentorUserId, sessionTypeCode);

      // Assert
      expect(result).toBeNull();
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });

    it("should return null when mentorUserId is empty", async () => {
      // Arrange
      const mentorUserId = "";
      const sessionTypeCode = "consultation";

      // Act
      const result = await service.getMentorPrice(mentorUserId, sessionTypeCode);

      // Assert
      expect(result).toBeNull();
      expect(mockDb.query.mentorPrices.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("createMentorPrice", () => {
    it("should create mentor price successfully", async () => {
      // Arrange
      const dto: CreateMentorPriceRequestDto = {
        mentorUserId: "mentor-123",
        sessionTypeCode: "consultation",
        price: 100,
        currency: "USD",
        status: "active",
      };

      const mockCreatedPrice = {
        ...dto,
        id: "price-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(null);
      mockDb.returning.mockResolvedValue([mockCreatedPrice]);

      // Act
      const result = await service.createMentorPrice(dto);

      // Assert
      expect(result).toEqual(mockCreatedPrice);
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("should throw FinancialConflictException when mentor price already exists", async () => {
      // Arrange
      const dto: CreateMentorPriceRequestDto = {
        mentorUserId: "mentor-123",
        sessionTypeCode: "consultation",
        price: 100,
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue({
        id: "price-123",
      });

      // Act & Assert
      await expect(service.createMentorPrice(dto)).rejects.toThrow(
        FinancialException,
      );
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
    });

    it("should throw FinancialException when price is invalid", async () => {
      // Arrange
      const dto: CreateMentorPriceRequestDto = {
        mentorUserId: "mentor-123",
        sessionTypeCode: "consultation",
        price: -100, // Invalid price
      };

      // Act & Assert
      await expect(service.createMentorPrice(dto)).rejects.toThrow(
        FinancialException,
      );
    });
  });

  describe("updateMentorPrice", () => {
    it("should update mentor price successfully", async () => {
      // Arrange
      const priceId = "price-123";
      const dto: UpdateMentorPriceRequestDto = {
        price: 150,
      };

      const existingPrice = {
        id: priceId,
        mentorUserId: "mentor-123",
        sessionTypeCode: "consultation",
        price: 100,
        currency: "USD",
        status: "active",
      };

      const updatedPrice = {
        ...existingPrice,
        price: 150,
        updatedAt: new Date(),
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);
      mockDb.returning.mockResolvedValue([updatedPrice]);

      // Act
      const result = await service.updateMentorPrice(priceId, dto);

      // Assert
      expect(result).toEqual(updatedPrice);
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it("should throw FinancialNotFoundException when mentor price not found", async () => {
      // Arrange
      const priceId = "non-existent-price";
      const dto: UpdateMentorPriceRequestDto = {
        price: 150,
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateMentorPrice(priceId, dto)).rejects.toThrow(
        FinancialException,
      );
    });

    it("should validate currency when provided", async () => {
      // Arrange
      const priceId = "price-123";
      const existingPrice = {
        id: priceId,
        price: "100",
        currency: "USD",
        status: "active",
      };
      const dto: UpdateMentorPriceRequestDto = {
        currency: "CNY",
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);
      mockDb.returning.mockResolvedValue([{ ...existingPrice, currency: "CNY" }]);

      // Act
      await service.updateMentorPrice(priceId, dto);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should validate status when provided", async () => {
      // Arrange
      const priceId = "price-123";
      const existingPrice = {
        id: priceId,
        price: "100",
        currency: "USD",
        status: "active",
      };
      const dto: UpdateMentorPriceRequestDto = {
        status: "inactive",
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);
      mockDb.returning.mockResolvedValue([{ ...existingPrice, status: "inactive" }]);

      // Act
      await service.updateMentorPrice(priceId, dto);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error when database update fails", async () => {
      // Arrange
      const priceId = "price-123";
      const existingPrice = {
        id: priceId,
        price: "100",
        currency: "USD",
        status: "active",
      };
      const dto: UpdateMentorPriceRequestDto = {
        price: 150,
      };
      const dbError = new Error("Database error");

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockRejectedValue(dbError),
      });

      // Act & Assert
      await expect(service.updateMentorPrice(priceId, dto)).rejects.toThrow(
        FinancialException,
      );
    });
  });

  describe("updateMentorPriceStatus", () => {
    it("should update mentor price status successfully", async () => {
      // Arrange
      const priceId = "price-123";
      const existingPrice = {
        id: priceId,
        status: "active",
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);

      // Act
      await service.updateMentorPriceStatus(priceId, "inactive");

      // Assert
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "inactive",
        }),
      );
    });

    it("should throw FinancialNotFoundException when mentor price not found", async () => {
      // Arrange
      const priceId = "non-existent-price";

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateMentorPriceStatus(priceId, "inactive"),
      ).rejects.toThrow(FinancialException);
    });

    it("should not update when mentor price is already in target status", async () => {
      // Arrange
      const priceId = "price-123";
      const existingPrice = {
        id: priceId,
        status: "inactive",
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);

      // Act
      await service.updateMentorPriceStatus(priceId, "inactive");

      // Assert
      expect(mockDb.query.mentorPrices.findFirst).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw error for invalid status", async () => {
      // Arrange
      const priceId = "price-123";

      // Act & Assert
      await expect(
        service.updateMentorPriceStatus(
          priceId,
          "invalid" as "active" | "inactive",
        ),
      ).rejects.toThrow(FinancialException);
    });

    it("should update status from inactive to active", async () => {
      // Arrange
      const priceId = "price-123";
      const existingPrice = {
        id: priceId,
        status: "inactive",
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(existingPrice);

      // Act
      await service.updateMentorPriceStatus(priceId, "active");

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
        }),
      );
    });
  });

  describe("searchMentorPrices", () => {
    it("should search mentor prices with filters", async () => {
      // Arrange
      const mockPrices = [
        {
          id: "price-123",
          mentorUserId: "mentor-123",
          sessionTypeCode: "consultation",
          price: 100,
          status: "active",
        },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockReturnThis();
      mockDb.execute.mockResolvedValue(mockPrices);

      // Act
      const result = await service.searchMentorPrices({
        mentorUserId: "mentor-123",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toEqual(mockPrices);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return paginated results", async () => {
      // Arrange
      const mockPrices = [
        {
          id: "price-123",
          mentorUserId: "mentor-123",
          sessionTypeCode: "consultation",
          price: 100,
          status: "active",
        },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockReturnThis();
      mockDb.execute.mockResolvedValue(mockPrices);

      // Act
      const result = await service.searchMentorPrices(
        {},
        { page: 1, pageSize: 10 },
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it("should handle invalid sort field by using default sort", async () => {
      // Arrange
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockReturnThis();
      mockDb.execute.mockResolvedValueOnce([{ count: 0 }]).mockResolvedValueOnce([]);

      // Act
      const result = await service.searchMentorPrices(
        {},
        { page: 1, pageSize: 10 },
        { field: "invalidField", order: "asc" },
      );

      // Assert
      expect(result).toBeDefined();
    });

    it("should filter by packageCode", async () => {
      // Arrange
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockReturnThis();
      mockDb.execute.mockResolvedValueOnce([{ count: 0 }]).mockResolvedValueOnce([]);

      // Act
      const result = await service.searchMentorPrices(
        { packageCode: "package-123" },
        { page: 1, pageSize: 10 },
      );

      // Assert
      expect(result).toBeDefined();
    });

    it("should handle search error", async () => {
      // Arrange
      const dbError = new Error("Database error");
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.execute.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        service.searchMentorPrices({}, { page: 1, pageSize: 10 }),
      ).rejects.toThrow(FinancialException);
    });
  });

  describe("batchCreateMentorPrices", () => {
    it("should return empty array when dtos is empty", async () => {
      // Act
      const result = await service.batchCreateMentorPrices([]);

      // Assert
      expect(result).toEqual([]);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should bulk create mentor prices successfully", async () => {
      // Arrange
      const dtos: CreateMentorPriceRequestDto[] = [
        {
          mentorUserId: "mentor-123",
          sessionTypeCode: "consultation",
          price: 100,
        },
        {
          mentorUserId: "mentor-123",
          sessionTypeCode: "coaching",
          price: 150,
        },
      ];

      const mockCreatedPrices = [
        {
          ...dtos[0],
          id: "price-123",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          ...dtos[1],
          id: "price-456",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(null);
      mockDb.returning
        .mockResolvedValueOnce([mockCreatedPrices[0]])
        .mockResolvedValueOnce([mockCreatedPrices[1]]);

      // Act
      const result = await service.batchCreateMentorPrices(dtos);

      // Assert
      expect(result).toEqual(mockCreatedPrices);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error when batch contains duplicate combinations", async () => {
      // Arrange
      const dtos: CreateMentorPriceRequestDto[] = [
        {
          mentorUserId: "mentor-123",
          sessionTypeCode: "consultation",
          price: 100,
        },
        {
          mentorUserId: "mentor-123",
          sessionTypeCode: "consultation",
          price: 150,
        },
      ];

      // Act & Assert
      await expect(service.batchCreateMentorPrices(dtos)).rejects.toThrow(
        FinancialException,
      );
    });
  });

  describe("batchUpdateMentorPrices", () => {
    it("should bulk update mentor prices successfully", async () => {
      // Arrange
      const updates = [
        {
          id: "price-123",
          dto: { price: 110 } as UpdateMentorPriceRequestDto,
        },
        {
          id: "price-456",
          dto: { price: 160 } as UpdateMentorPriceRequestDto,
        },
      ];

      const mockExistingPrice = {
        id: "price-123",
        mentorUserId: "mentor-123",
        sessionTypeCode: "consultation",
        price: 100,
        status: "active",
      };

      const mockUpdatedPrice = {
        ...mockExistingPrice,
        price: 110,
        updatedAt: new Date(),
      };

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(mockExistingPrice);
      mockDb.returning.mockResolvedValue([mockUpdatedPrice]);

      // Act
      const result = await service.batchUpdateMentorPrices(updates);

      // Assert
      expect(result).toBeDefined();
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error when price not found", async () => {
      // Arrange
      const updates = [
        {
          id: "non-existent-price",
          dto: { price: 110 } as UpdateMentorPriceRequestDto,
        },
      ];

      mockDb.query.mentorPrices.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.batchUpdateMentorPrices(updates)).rejects.toThrow(
        FinancialException,
      );
    });
  });
});
