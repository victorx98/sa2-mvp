import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServiceService } from "./service.service";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  ServiceType,
  BillingMode,
  ServiceStatus,
  ServiceUnit,
} from "../../common/interfaces/enums";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import { eq, and, or, like, ne, count, sql } from "drizzle-orm";

// Mock 数据库模块
jest.mock("@infrastructure/database/database.module", () => ({
  DatabaseModule: jest.fn().mockImplementation(() => ({
    module: class MockDatabaseModule {},
  })),
}));

// Mock 数据库提供者
jest.mock("@infrastructure/database/database.provider", () => ({
  DATABASE_CONNECTION: jest.fn(),
}));

describe("ServiceService (Unit Tests with Mock Data)", () => {
  let service: ServiceService;
  let mockDb: jest.Mocked<NodePgDatabase<typeof schema>>;

  // 测试数据
  const testUserId = "test-user-id";
  const testServiceId = "test-service-id";
  const testServiceCode = "test_service_code";
  const testServiceName = "Test Service";
  const testServiceDescription = "Test service description";

  // Mock 服务数据
  const mockService = {
    id: testServiceId,
    code: testServiceCode,
    serviceType: ServiceType.RESUME_REVIEW,
    name: testServiceName,
    description: testServiceDescription,
    coverImage: "https://example.com/image.jpg",
    billingMode: BillingMode.ONE_TIME,
    requiresEvaluation: false,
    requiresMentorAssignment: true,
    status: ServiceStatus.ACTIVE,
    metadata: {
      features: ["feature1", "feature2"],
      deliverables: ["deliverable1"],
      duration: 60,
      prerequisites: ["prerequisite1"],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: testUserId,
  };

  // Mock 服务包项数据
  const mockServicePackageItem = {
    id: "test-package-item-id",
    packageId: "test-package-id",
    serviceId: testServiceId,
    quantity: 1,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock 产品项数据
  const mockProductItem = {
    id: "test-product-item-id",
    productId: "test-product-id",
    type: "service",
    referenceId: testServiceId,
    quantity: 1,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // 创建 mock 数据库对象
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    } as any;

    // 创建测试模块
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
      ],
      providers: [
        ServiceService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);

    // 设置 mock 返回值
    const mockSelectChain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockService]),
    };

    const mockUpdateChain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockService]),
    };

    const mockInsertChain = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockService]),
    };

    // 修复 mockDb.select 的类型问题
    mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);
    mockDb.update = jest.fn().mockReturnValue(mockUpdateChain as any);
    mockDb.insert = jest.fn().mockReturnValue(mockInsertChain as any);
  });

  describe("create", () => {
    it("should successfully create a service", async () => {
      // Arrange
      const createDto = {
        code: testServiceCode,
        serviceType: ServiceType.RESUME_REVIEW,
        name: testServiceName,
        description: testServiceDescription,
        billingMode: BillingMode.ONE_TIME,
        defaultUnit: ServiceUnit.TIMES,
        requiresEvaluation: false,
        requiresMentorAssignment: true,
      };

      // Mock 查询结果为空（验证唯一性）
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有重复的 code
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有重复的 serviceType
      };

      const mockInsertChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockService]),
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any);
      // 修复 mockDb.insert 的类型问题
      mockDb.insert = jest.fn().mockReturnValue(mockInsertChain as any);

      // Act
      const result = await service.create(createDto, testUserId);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.code).toBe(createDto.code);
      expect(result.status).toBe(ServiceStatus.ACTIVE);
      expect(result.createdBy).toBe(testUserId);
      expect(result.serviceType).toBe(ServiceType.RESUME_REVIEW);
    });

    it("should reject duplicate service code", async () => {
      // Arrange
      const code = "unique_code";
      const createDto = {
        code,
        serviceType: ServiceType.MOCK_INTERVIEW,
        name: "Another Service",
        billingMode: BillingMode.ONE_TIME,
      };

      // Mock 查询结果为已存在（验证唯一性）
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]), // 有重复的 code
      };

      mockDb.select.mockReturnValueOnce(mockSelectChain as any);

      // Act & Assert
      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogConflictException,
      );
    });

    it("should reject duplicate service type", async () => {
      // Arrange
      const createDto = {
        code: "another_code",
        serviceType: ServiceType.SESSION,
        name: "1-on-1 Session",
        billingMode: BillingMode.PER_SESSION,
        defaultUnit: ServiceUnit.HOURS,
      };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有重复的 code
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]), // 有重复的 serviceType
      };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any);

      // Act & Assert
      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogConflictException,
      );
    });
  });

  describe("update", () => {
    it("should successfully update a service", async () => {
      // Arrange
      const updateDto = {
        name: "Updated Name",
        description: "Updated Description",
      };

      const updatedService = {
        ...mockService,
        name: updateDto.name,
        description: updateDto.description,
      };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]), // 服务存在
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有服务包引用
      };

      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有产品项引用
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedService]),
      };

      // 修复 mockDb.select 和 mockDb.update 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any);
      mockDb.update = jest.fn().mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await service.update(testServiceId, updateDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it("should reject updating non-existent service", async () => {
      // Arrange
      const updateDto = { name: "Updated Name" };
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Mock 查询结果为空
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 服务不存在
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValueOnce(mockSelectChain as any);

      // Act & Assert
      await expect(service.update(nonExistentId, updateDto)).rejects.toThrow(
        CatalogNotFoundException,
      );
    });

    it("should reject updating deleted service", async () => {
      // Arrange
      const updateDto = { name: "Updated Name" };
      const deletedService = { ...mockService, status: ServiceStatus.DELETED };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([deletedService]), // 服务已删除
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValueOnce(mockSelectChain as any);

      // Act & Assert
      await expect(service.update(testServiceId, updateDto)).rejects.toThrow(
        CatalogGoneException,
      );
    });
  });

  describe("findOne", () => {
    it("should find service by ID", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act
      const result = await service.findOne({ id: testServiceId });

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(testServiceId);
    });

    it("should find service by code", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act
      const result = await service.findOne({ code: testServiceCode });

      // Assert
      expect(result).toBeDefined();
      expect(result?.code).toBe(testServiceCode);
    });

    it("should return null for non-existent service", async () => {
      // Arrange
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 服务不存在
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act
      const result = await service.findOne({ id: nonExistentId });

      // Assert
      expect(result).toBeNull();
    });

    it("should require at least one query parameter", async () => {
      // Act & Assert
      await expect(service.findOne({})).rejects.toThrow(CatalogException);
    });
  });

  describe("updateStatus", () => {
    it("should successfully update service status to inactive", async () => {
      // Arrange
      const activeService = { ...mockService, status: ServiceStatus.ACTIVE };
      const inactiveService = {
        ...mockService,
        status: ServiceStatus.INACTIVE,
      };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([activeService]), // 服务存在且活跃
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有服务包引用
      };

      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有产品项引用
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([inactiveService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any);
      mockDb.update = jest.fn().mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await service.updateStatus(testServiceId, "inactive");

      // Assert
      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });

    it("should successfully update service status to active", async () => {
      // Arrange
      const inactiveService = {
        ...mockService,
        status: ServiceStatus.INACTIVE,
      };
      const activeService = { ...mockService, status: ServiceStatus.ACTIVE };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([inactiveService]), // 服务存在且非活跃
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有服务包引用
      };

      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有产品项引用
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([activeService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any);
      mockDb.update = jest.fn().mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await service.updateStatus(testServiceId, "active");

      // Assert
      expect(result.status).toBe(ServiceStatus.ACTIVE);
    });

    it("should reject updating status of non-existent service", async () => {
      // Arrange
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 服务不存在
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValueOnce(mockSelectChain as any);

      // Act & Assert
      await expect(
        service.updateStatus(nonExistentId, "inactive"),
      ).rejects.toThrow(CatalogNotFoundException);
    });

    it("should reject updating status of deleted service", async () => {
      // Arrange
      const deletedService = { ...mockService, status: ServiceStatus.DELETED };
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([deletedService]), // 服务已删除
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValueOnce(mockSelectChain as any);

      // Act & Assert
      await expect(
        service.updateStatus(testServiceId, "active"),
      ).rejects.toThrow(CatalogGoneException);
    });
  });

  describe("remove", () => {
    it("should reject deleting active service", async () => {
      // Arrange
      const activeService = { ...mockService, status: ServiceStatus.ACTIVE };
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([activeService]), // 服务存在且活跃
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(service.remove(testServiceId)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should successfully delete inactive service", async () => {
      // Arrange
      const inactiveService = {
        ...mockService,
        status: ServiceStatus.INACTIVE,
      };
      const deletedService = { ...mockService, status: ServiceStatus.DELETED };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([inactiveService]), // 服务存在且非活跃
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有服务包引用
      };

      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 没有产品项引用
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([deletedService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any);
      mockDb.update = jest.fn().mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await service.remove(testServiceId);

      // Assert
      expect(result.status).toBe(ServiceStatus.DELETED);
    });

    it("should reject deleting service that is referenced", async () => {
      // Arrange
      const inactiveService = {
        ...mockService,
        status: ServiceStatus.INACTIVE,
      };

      // Mock 查询结果
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([inactiveService]), // 服务存在且非活跃
      };

      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockServicePackageItem]), // 有服务包引用
      };

      const mockSelectChain3 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProductItem]), // 有产品项引用
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any)
        .mockReturnValueOnce(mockSelectChain2 as any)
        .mockReturnValueOnce(mockSelectChain3 as any);

      // Act & Assert
      await expect(service.remove(testServiceId)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted service", async () => {
      // Arrange
      const serviceId = "service-123";
      const deletedService = {
        ...mockService,
        id: serviceId,
        status: ServiceStatus.DELETED,
      };
      const restoredService = {
        ...deletedService,
        status: ServiceStatus.ACTIVE,
      };
      const mockServices = [deletedService];
      const mockCount = [{ total: 1 }];

      // Mock 查询服务
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockServices),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([restoredService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);
      mockDb.update = jest.fn().mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await service.restore(serviceId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(serviceId);
      expect(result.status).toBe(ServiceStatus.ACTIVE);
    });

    it("should throw an error if service does not exist", async () => {
      // Arrange
      const serviceId = "non-existent-service";
      const mockServices: any[] = [];

      // Mock 查询服务
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockServices), // 返回空数组，表示服务不存在
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(service.restore(serviceId)).rejects.toThrow(
        "Service not found",
      );
    });
  });

  describe("generateSnapshot", () => {
    it("should successfully generate service snapshot", async () => {
      // Arrange
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockService]),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act
      const snapshot = await service.generateSnapshot(testServiceId);

      // Assert
      expect(snapshot.serviceId).toBe(testServiceId);
      expect(snapshot.serviceName).toBe(testServiceName);
      expect(snapshot.serviceCode).toBe(testServiceCode);
      expect(snapshot.snapshotAt).toBeDefined();
    });

    it("should reject generating snapshot for non-existent service", async () => {
      // Arrange
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]), // 服务不存在
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act & Assert
      await expect(service.generateSnapshot(nonExistentId)).rejects.toThrow(
        CatalogNotFoundException,
      );
    });
  });

  describe("search", () => {
    it("should search services with pagination", async () => {
      // Arrange
      const mockServices = [mockService];
      const mockCount = [{ total: 1 }];

      // Mock 查询总数
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockCount),
      };

      // Mock 查询数据
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue(mockServices),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any) // 第一次调用：查询总数
        .mockReturnValueOnce(mockSelectChain2 as any); // 第二次调用：查询数据

      const filters = {};
      const pagination = { page: 1, pageSize: 10 };

      // Act
      const result = await service.search(filters, pagination);

      // Assert
      expect(result.data).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBeGreaterThan(0);
    });

    it("should filter services by status", async () => {
      // Arrange
      const mockServices = [mockService];
      const mockCount = [{ total: 1 }];

      // Mock 查询总数
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockCount),
      };

      // Mock 查询数据（无分页）
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockServices),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any) // 第一次调用：查询总数
        .mockReturnValueOnce(mockSelectChain2 as any); // 第二次调用：查询数据（无分页）

      const filters = { status: ServiceStatus.ACTIVE };

      // Act
      const result = await service.search(filters);

      // Assert
      expect(result.data.every((s) => s.status === ServiceStatus.ACTIVE)).toBe(
        true,
      );
    });

    it("should filter services by billing mode", async () => {
      // Arrange
      const mockServices = [mockService];
      const mockCount = [{ total: 1 }];

      // Mock 查询总数
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockCount),
      };

      // Mock 查询数据（无分页）
      const mockSelectChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockServices),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce(mockSelectChain as any) // 第一次调用：查询总数
        .mockReturnValueOnce(mockSelectChain2 as any); // 第二次调用：查询数据（无分页）

      const filters = { billingMode: BillingMode.ONE_TIME };

      // Act
      const result = await service.search(filters);

      // Assert
      expect(
        result.data.every((s) => s.billingMode === BillingMode.ONE_TIME),
      ).toBe(true);
    });
  });

  describe("findAvailableServices", () => {
    it("should return only active services", async () => {
      // Arrange
      const mockServices = [mockService];
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockServices),
      };

      // 修复 mockDb.select 的类型问题
      mockDb.select = jest.fn().mockReturnValue(mockSelectChain as any);

      // Act
      const result = await service.findAvailableServices();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((s) => s.status === ServiceStatus.ACTIVE)).toBe(true);
    });
  });
});
