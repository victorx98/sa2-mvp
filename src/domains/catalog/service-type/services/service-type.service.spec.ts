import { Test, TestingModule } from "@nestjs/testing";
import { ServiceTypeService } from "./service-type.service";
import { ServiceTypeRepository } from "../service-type.repository";
import { ServiceTypeFilterDto } from "../dto/service-type-filter.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { SortDto } from "../../common/dto/sort.dto";
import { randomUUID } from "crypto";

// Mock ServiceTypeRepository
const mockServiceTypeRepository = {
  findMany: jest.fn(),
  count: jest.fn(),
};

// Generate mock service type
const generateMockServiceType = (overrides: any = {}) => ({
  id: randomUUID(),
  code: `ST-${Math.floor(Math.random() * 1000)}`,
  name: `Test Service Type ${Math.floor(Math.random() * 1000)}`,
  description: `Test description for service type`,
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ServiceTypeService", () => {
  let service: ServiceTypeService;
  let mockRepository: any;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceTypeService,
        {
          provide: ServiceTypeRepository,
          useValue: mockServiceTypeRepository,
        },
      ],
    }).compile();

    service = module.get<ServiceTypeService>(ServiceTypeService);
    mockRepository = module.get<ServiceTypeRepository>(ServiceTypeRepository);
  });

  describe("search", () => {
    it("should return paginated service types successfully [应该成功返回分页的服务类型]", async () => {
      // Arrange
      const filter: ServiceTypeFilterDto = { status: "ACTIVE" };
      const pagination: PaginationDto = { page: 1, pageSize: 10 };
      const sort: SortDto = { orderField: "createdAt", orderDirection: "desc" };

      const mockServiceTypes = Array.from({ length: 5 }, () =>
        generateMockServiceType(),
      );
      const total = 15;

      mockRepository.findMany.mockResolvedValue(mockServiceTypes);
      mockRepository.count.mockResolvedValue(total);

      // Act
      const result = await service.search(filter, pagination, sort);

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toEqual(mockServiceTypes);
      expect(result.total).toBe(total);
      expect(result.page).toBe(pagination.page);
      expect(result.pageSize).toBe(pagination.pageSize);
      expect(result.totalPages).toBe(Math.ceil(total / pagination.pageSize));

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        filter,
        pagination,
        sort,
      );
      expect(mockRepository.count).toHaveBeenCalledWith(filter);
    });

    it("should return empty result when total is 0 [当总数为0时应该返回空结果]", async () => {
      // Arrange
      const filter: ServiceTypeFilterDto = { status: "ACTIVE" };

      mockRepository.findMany.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      // Act
      const result = await service.search(filter);

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);

      expect(mockRepository.count).toHaveBeenCalledWith(filter);
      expect(mockRepository.findMany).not.toHaveBeenCalled();
    });

    it("should use default pagination when not provided [当未提供分页时应该使用默认分页]", async () => {
      // Arrange
      const filter: ServiceTypeFilterDto = { status: "ACTIVE" };

      const mockServiceTypes = Array.from({ length: 20 }, () =>
        generateMockServiceType(),
      );
      const total = 20;

      mockRepository.findMany.mockResolvedValue(mockServiceTypes);
      mockRepository.count.mockResolvedValue(total);

      // Act
      const result = await service.search(filter);

      // Assert
      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        filter,
        undefined,
        undefined,
      );
    });
  });
});
