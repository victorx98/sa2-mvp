import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServiceService } from "@domains/catalog/service/services/service.service";
import { ServicePackageService } from "@domains/catalog/service-package/services/service-package.service";
import { ServiceModule } from "@domains/catalog/service/service.module";
import { ServicePackageModule } from "@domains/catalog/service-package/service-package.module";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { CreateServicePackageDto } from "@domains/catalog/service-package/dto/create-service-package.dto";
import { UpdateServicePackageDto } from "@domains/catalog/service-package/dto/update-service-package.dto";
import { AddServiceDto } from "@domains/catalog/service-package/dto/add-service.dto";
import { PackageFilterDto } from "@domains/catalog/service-package/dto/package-filter.dto";
import {
  ServiceType,
  ServiceStatus,
  
  BillingMode,
} from "@domains/catalog/common/interfaces/enums";
import { CatalogException } from "@domains/catalog/common/exceptions/catalog.exception";
import { createTestFixtures, TestFixtures } from "../utils/test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

describe("ServicePackageService Integration Tests", () => {
  let moduleRef: TestingModule;
  let serviceService: ServiceService;
  let packageService: ServicePackageService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;
  let testUserId: string;
  const createdServiceIds: string[] = [];
  const createdPackageIds: string[] = [];

  // Test services
  let gapAnalysisServiceId: string;
  let resumeReviewServiceId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
        ServiceModule,
        ServicePackageModule,
      ],
    }).compile();

    serviceService = moduleRef.get<ServiceService>(ServiceService);
    packageService = moduleRef.get<ServicePackageService>(
      ServicePackageService,
    );
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);

    // Clean up and create test user
    await fixtures.cleanupAll();
    const user = await fixtures.createUser();
    testUserId = user.id;

    // Create test services
    const gapAnalysis = await serviceService.create(
      {
        code: `GAP-PKG-${Date.now()}`,
        serviceType: ServiceType.GAP_ANALYSIS,
        name: "Gap Analysis",
        billingMode: BillingMode.ONE_TIME,
      },
      testUserId,
    );
    gapAnalysisServiceId = gapAnalysis.id;
    createdServiceIds.push(gapAnalysisServiceId);

    const resumeReview = await serviceService.create(
      {
        code: `RESUME-PKG-${Date.now()}`,
        serviceType: ServiceType.RESUME_REVIEW,
        name: "Resume Review",
        billingMode: BillingMode.ONE_TIME,
      },
      testUserId,
    );
    resumeReviewServiceId = resumeReview.id;
    createdServiceIds.push(resumeReviewServiceId);
  });

  afterAll(async () => {
    // Clean up all test data
    await fixtures.cleanupAll();

    await moduleRef.close();
  });

  beforeEach(async () => {
    // Clean up and recreate test services before each test
    await fixtures.cleanupAllCatalogData();

    const gapAnalysis = await serviceService.create(
      {
        code: `GAP-PKG-${Date.now()}`,
        serviceType: ServiceType.GAP_ANALYSIS,
        name: "Gap Analysis",
        billingMode: BillingMode.ONE_TIME,
      },
      testUserId,
    );
    gapAnalysisServiceId = gapAnalysis.id;

    const resumeReview = await serviceService.create(
      {
        code: `RESUME-PKG-${Date.now()}`,
        serviceType: ServiceType.RESUME_REVIEW,
        name: "Resume Review",
        billingMode: BillingMode.ONE_TIME,
      },
      testUserId,
    );
    resumeReviewServiceId = resumeReview.id;
  });

  describe("创建服务包 (create)", () => {
    it("应该成功创建一个空的服务包", async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-EMPTY-${Date.now()}`,
        name: "空服务包",
        description: "用于测试的空服务包",
      };

      const result = await packageService.create(dto, testUserId);
      createdPackageIds.push(result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe(dto.code);
      expect(result.name).toBe(dto.name);
      expect(result.status).toBe(ServiceStatus.ACTIVE);
    });

    it("应该成功创建包含服务项的服务包", async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-WITH-ITEMS-${Date.now()}`,
        name: "基础套餐",
        description: "包含Gap Analysis和Resume Review",
        coverImage: "https://example.com/package.jpg",
        items: [
          {
            serviceId: gapAnalysisServiceId,
            quantity: 1,
          },
          {
            serviceId: resumeReviewServiceId,
            quantity: 2,
          },
        ],
        metadata: {
          features: ["Career guidance", "Resume review"],
        },
      };

      const result = await packageService.create(dto, testUserId);
      createdPackageIds.push(result.id);

      expect(result.code).toBe(dto.code);
      expect(result.metadata).toEqual(dto.metadata);
    });

    it("应该拒绝重复的code", async () => {
      const code = `PKG-DUPLICATE-${Date.now()}`;
      const dto: CreateServicePackageDto = {
        code,
        name: "套餐1",
      };

      const result = await packageService.create(dto, testUserId);
      createdPackageIds.push(result.id);

      // 尝试创建相同code的服务包
      const duplicateDto: CreateServicePackageDto = {
        code,
        name: "套餐2",
      };

      await expect(
        packageService.create(duplicateDto, testUserId),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("查询服务包 (findOne, search)", () => {
    let testPackageId: string;

    beforeAll(async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-QUERY-${Date.now()}`,
        name: "查询测试套餐",
        description: "用于查询测试",
        items: [
          {
            serviceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      };

      const result = await packageService.create(dto, testUserId);
      testPackageId = result.id;
      createdPackageIds.push(testPackageId);
    });

    it("应该能通过ID查询服务包", async () => {
      const result = await packageService.findOne({ id: testPackageId });

      expect(result).toBeDefined();
      expect(result.id).toBe(testPackageId);
      expect(result.name).toBe("查询测试套餐");
    });

    it("应该能通过code查询服务包", async () => {
      const pkg = await packageService.findOne({ id: testPackageId });
      const result = await packageService.findOne({ code: pkg.code });

      expect(result).toBeDefined();
      expect(result.id).toBe(testPackageId);
      expect(result.code).toBe(pkg.code);
    });

    it("查询不存在的服务包应该返回null", async () => {
      const result = await packageService.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });

    it("应该能按关键词搜索服务包", async () => {
      const filters: PackageFilterDto = {
        keyword: "查询测试",
      };

      const result = await packageService.search(filters);

      expect(result.data.length).toBeGreaterThan(0);
    });

    it("应该支持分页查询", async () => {
      const filters: PackageFilterDto = {};
      const pagination = { page: 1, pageSize: 2 };

      const result = await packageService.search(filters, pagination);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("更新服务包 (update)", () => {
    let testPackageId: string;

    beforeEach(async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-UPDATE-${Date.now()}`,
        name: "原始名称",
        description: "原始描述",
      };

      const result = await packageService.create(dto, testUserId);
      testPackageId = result.id;
      createdPackageIds.push(testPackageId);
    });

    it("应该能更新服务包的名称和描述", async () => {
      const updateDto: UpdateServicePackageDto = {
        name: "更新后的名称",
        description: "更新后的描述",
      };

      const result = await packageService.update(testPackageId, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it("应该能更新服务包的metadata", async () => {
      const updateDto: UpdateServicePackageDto = {
        metadata: {
          features: ["Interview prep", "Career planning"],
        },
      };

      const result = await packageService.update(testPackageId, updateDto);

      expect(result.metadata).toEqual(updateDto.metadata);
    });
  });

  describe("管理服务包项 (addService, removeService)", () => {
    let testPackageId: string;

    beforeEach(async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-ITEMS-${Date.now()}`,
        name: "项目管理测试套餐",
      };

      const result = await packageService.create(dto, testUserId);
      testPackageId = result.id;
      createdPackageIds.push(testPackageId);
    });

    it("应该能向服务包添加服务", async () => {
      const addDto: AddServiceDto = {
        serviceId: gapAnalysisServiceId,
        quantity: 1,
      };

      await packageService.addService(testPackageId, addDto);

      const result = await packageService.findOne({ id: testPackageId });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].serviceId).toBe(gapAnalysisServiceId);
    });

    it("应该能从服务包移除服务", async () => {
      // 先添加服务
      await packageService.addService(testPackageId, {
        serviceId: gapAnalysisServiceId,
        quantity: 1,
      });

      // 移除服务
      await packageService.removeService(testPackageId, gapAnalysisServiceId);

      const result = await packageService.findOne({ id: testPackageId });
      expect(result.items).toHaveLength(0);
    });
  });

  describe("停用和删除服务包 (updateStatus, remove)", () => {
    it("应该能停用一个active状态的服务包", async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-DEACTIVATE-${Date.now()}`,
        name: "待停用套餐",
      };

      const created = await packageService.create(dto, testUserId);
      createdPackageIds.push(created.id);

      const result = await packageService.updateStatus(created.id, "inactive");

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });

    it("应该能删除一个服务包", async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-DELETE-${Date.now()}`,
        name: "待删除套餐",
      };

      const created = await packageService.create(dto, testUserId);

      const result = await packageService.remove(created.id);

      expect(result.status).toBe(ServiceStatus.DELETED);

      // 验证删除后无法再查询到
      const found = await packageService.findOne({ id: created.id });
      expect(found).toBeNull();
    });
  });

  describe("生成快照 (generateSnapshot)", () => {
    it("应该能获取服务包的完整快照", async () => {
      const dto: CreateServicePackageDto = {
        code: `PKG-SNAPSHOT-${Date.now()}`,
        name: "快照测试套餐",
        items: [
          {
            serviceId: gapAnalysisServiceId,
            quantity: 1,
          },
        ],
      };

      const created = await packageService.create(dto, testUserId);
      createdPackageIds.push(created.id);

      const snapshot = await packageService.generateSnapshot(created.id);

      expect(snapshot).toBeDefined();
      expect(snapshot.packageId).toBe(created.id);
      expect(snapshot.items).toHaveLength(1);
      expect(snapshot.items[0].serviceSnapshot).toBeDefined();
    });
  });
});
