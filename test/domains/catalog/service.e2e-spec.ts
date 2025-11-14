import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServiceService } from "@domains/catalog/service/services/service.service";
import { ServiceModule } from "@domains/catalog/service/service.module";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { CreateServiceDto } from "@domains/catalog/service/dto/create-service.dto";
import { UpdateServiceDto } from "@domains/catalog/service/dto/update-service.dto";
import { ServiceFilterDto } from "@domains/catalog/service/dto/service-filter.dto";
import {
  ServiceType,
  ServiceStatus,
  BillingMode,
} from "@domains/catalog/common/interfaces/enums";
import { CatalogException } from "@domains/catalog/common/exceptions/catalog.exception";
import { createTestFixtures, TestFixtures } from "../../utils/test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

describe("ServiceService Integration Tests", () => {
  let moduleRef: TestingModule;
  let serviceService: ServiceService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;
  let testUserId: string;
  const createdServiceIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
        ServiceModule,
      ],
    }).compile();

    serviceService = moduleRef.get<ServiceService>(ServiceService);
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);

    const user = await fixtures.createUser();
    testUserId = user.id;
  });

  afterAll(async () => {

    await moduleRef.close();
  });

  beforeEach(async () => {
  });

  describe("创建服务 (create)", () => {
    it("应该成功创建一个gap_analysis类型的服务", async () => {
      const dto: CreateServiceDto = {
        code: `GAP-${Date.now()}`,
        serviceType: ServiceType.GAP_ANALYSIS,
        name: "综合评估服务",
        description: "全面分析学生背景",
        billingMode: BillingMode.ONE_TIME,
        requiresEvaluation: true,
        requiresMentorAssignment: true,
      };

      const result = await serviceService.create(dto, testUserId);
      createdServiceIds.push(result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe(dto.code);
      expect(result.serviceType).toBe(ServiceType.GAP_ANALYSIS);
      expect(result.name).toBe(dto.name);
      expect(result.status).toBe(ServiceStatus.ACTIVE);
      expect(result.createdBy).toBe(testUserId);
    });

    it("应该成功创建一个resume_review类型的服务", async () => {
      const dto: CreateServiceDto = {
        code: `RESUME-${Date.now()}`,
        serviceType: ServiceType.RESUME_REVIEW,
        name: "简历优化服务",
        description: "专业简历修改",
        coverImage: "https://example.com/resume.jpg",
        billingMode: BillingMode.ONE_TIME,
        requiresEvaluation: false,
        requiresMentorAssignment: true,
        metadata: {
          features: ["专业润色", "排版优化"],
          deliverables: ["修改后简历", "修改说明"],
          duration: 3,
        },
      };

      const result = await serviceService.create(dto, testUserId);
      createdServiceIds.push(result.id);

      expect(result.code).toBe(dto.code);
      expect(result.serviceType).toBe(ServiceType.RESUME_REVIEW);
      expect(result.coverImage).toBe(dto.coverImage);
      expect(result.metadata).toHaveProperty("features");
    });

    it("应该拒绝重复的service_type", async () => {
      const dto: CreateServiceDto = {
        code: `DUPLICATE-${Date.now()}`,
        serviceType: ServiceType.SESSION,
        name: "1对1咨询",
        billingMode: BillingMode.PER_SESSION,
      };

      const result = await serviceService.create(dto, testUserId);
      createdServiceIds.push(result.id);

      // 尝试创建相同service_type的服务
      const duplicateDto: CreateServiceDto = {
        code: `DUPLICATE-2-${Date.now()}`,
        serviceType: ServiceType.SESSION,
        name: "另一个1对1咨询",
        billingMode: BillingMode.PER_SESSION,
      };

      await expect(
        serviceService.create(duplicateDto, testUserId),
      ).rejects.toThrow(CatalogException);
    });

    it("应该拒绝重复的code", async () => {
      const code = `UNIQUE-CODE-${Date.now()}`;
      const dto: CreateServiceDto = {
        code,
        serviceType: ServiceType.MOCK_INTERVIEW,
        name: "模拟面试",
        billingMode: BillingMode.ONE_TIME,
      };

      const result = await serviceService.create(dto, testUserId);
      createdServiceIds.push(result.id);

      // 尝试创建相同code的服务
      const duplicateDto: CreateServiceDto = {
        code,
        serviceType: ServiceType.CLASS_SESSION,
        name: "另一个服务",
        billingMode: BillingMode.PER_SESSION,
      };

      await expect(
        serviceService.create(duplicateDto, testUserId),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("查询服务 (findOne, findAvailableServices, search)", () => {
    let testServiceId: string;

    beforeAll(async () => {
      const dto: CreateServiceDto = {
        code: `QUERY-TEST-${Date.now()}`,
        serviceType: ServiceType.RECOMMENDATION_LETTER,
        name: "推荐信服务",
        description: "专业推荐信撰写",
        billingMode: BillingMode.ONE_TIME,
      };

      const result = await serviceService.create(dto, testUserId);
      testServiceId = result.id;
      createdServiceIds.push(testServiceId);
    });

    it("应该能通过ID查询服务", async () => {
      const result = await serviceService.findOne({ id: testServiceId });

      expect(result).toBeDefined();
      expect(result.id).toBe(testServiceId);
      expect(result.serviceType).toBe(ServiceType.RECOMMENDATION_LETTER);
    });

    it("应该能通过code查询服务", async () => {
      const service = await serviceService.findOne({ id: testServiceId });
      const result = await serviceService.findOne({ code: service.code });

      expect(result).toBeDefined();
      expect(result.id).toBe(testServiceId);
      expect(result.code).toBe(service.code);
    });

    it("查询不存在的服务应该返回null", async () => {
      const result = await serviceService.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });

    it("应该能查询所有可用的服务", async () => {
      const result = await serviceService.findAvailableServices();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((s) => s.status === ServiceStatus.ACTIVE)).toBe(true);
    });

    it("应该能按状态过滤服务", async () => {
      const filters: ServiceFilterDto = {
        status: ServiceStatus.ACTIVE,
      };

      const result = await serviceService.search(filters);

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((s) => s.status === ServiceStatus.ACTIVE)).toBe(
        true,
      );
    });

    it("应该能按billing_mode过滤服务", async () => {
      const filters: ServiceFilterDto = {
        billingMode: BillingMode.ONE_TIME,
      };

      const result = await serviceService.search(filters);

      expect(
        result.data.every((s) => s.billingMode === BillingMode.ONE_TIME),
      ).toBe(true);
    });

    it("应该能按关键词搜索服务", async () => {
      const filters: ServiceFilterDto = {
        keyword: "推荐信",
      };

      const result = await serviceService.search(filters);

      expect(result.data.length).toBeGreaterThan(0);
      expect(
        result.data.some(
          (s) => s.name.includes("推荐信") || s.description?.includes("推荐信"),
        ),
      ).toBe(true);
    });

    it("应该支持分页查询", async () => {
      const filters: ServiceFilterDto = {};
      const pagination = { page: 1, pageSize: 2 };

      const result = await serviceService.search(filters, pagination);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("更新服务 (update)", () => {
    let testServiceId: string;

    beforeEach(async () => {
      const dto: CreateServiceDto = {
        code: `UPDATE-TEST-${Date.now()}`,
        serviceType: ServiceType.INTERNAL_REFERRAL,
        name: "内推服务",
        description: "原始描述",
        billingMode: BillingMode.ONE_TIME,
      };

      const result = await serviceService.create(dto, testUserId);
      testServiceId = result.id;
      createdServiceIds.push(testServiceId);
    });

    it("应该能更新服务的名称和描述", async () => {
      const updateDto: UpdateServiceDto = {
        name: "更新后的内推服务",
        description: "更新后的描述",
      };

      const result = await serviceService.update(testServiceId, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it("应该能更新服务的coverImage", async () => {
      const updateDto: UpdateServiceDto = {
        coverImage: "https://example.com/new-image.jpg",
      };

      const result = await serviceService.update(testServiceId, updateDto);

      expect(result.coverImage).toBe(updateDto.coverImage);
    });

    it("应该能更新服务的metadata", async () => {
      const updateDto: UpdateServiceDto = {
        metadata: {
          features: ["内推辅导", "简历优化"],
          duration: 7,
        },
      };

      const result = await serviceService.update(testServiceId, updateDto);

      expect(result.metadata).toHaveProperty("features");
      expect(result.metadata).toHaveProperty("duration");
    });

    it("更新不存在的服务应该抛出异常", async () => {
      const updateDto: UpdateServiceDto = {
        name: "更新名称",
      };

      await expect(
        serviceService.update(
          "00000000-0000-0000-0000-000000000000",
          updateDto,
        ),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("停用和删除服务 (updateStatus, remove)", () => {
    it("应该能停用一个active状态的服务", async () => {
      const dto: CreateServiceDto = {
        code: `DEACTIVATE-${Date.now()}`,
        serviceType: ServiceType.PROXY_APPLICATION,
        name: "代申请服务",
        billingMode: BillingMode.ONE_TIME,
      };

      const created = await serviceService.create(dto, testUserId);
      createdServiceIds.push(created.id);

      const result = await serviceService.updateStatus(created.id, "inactive");

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });

    it("应该能删除一个服务", async () => {
      const dto: CreateServiceDto = {
        code: `DELETE-${Date.now()}`,
        serviceType: ServiceType.OTHER_SERVICE,
        name: "其他服务",
        billingMode: BillingMode.ONE_TIME,
      };

      const created = await serviceService.create(dto, testUserId);

      const result = await serviceService.remove(created.id);

      expect(result.status).toBe(ServiceStatus.DELETED);

      // 验证删除后无法再查询到（不包含deleted）
      const found = await serviceService.findOne({ id: created.id });
      expect(found).toBeNull();
    });

    it("停用不存在的服务应该抛出异常", async () => {
      await expect(
        serviceService.updateStatus(
          "00000000-0000-0000-0000-000000000000",
          "inactive",
        ),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("状态转换 (restore)", () => {
    it("应该能重新激活一个inactive状态的服务", async () => {
      const dto: CreateServiceDto = {
        code: `ACTIVATE-${Date.now()}`,
        serviceType: ServiceType.CONTRACT_SIGNING_ASSISTANCE,
        name: "合同签约协助",
        billingMode: BillingMode.ONE_TIME,
      };

      const created = await serviceService.create(dto, testUserId);
      createdServiceIds.push(created.id);

      // 先停用
      await serviceService.updateStatus(created.id, "inactive");

      // 再激活
      const result = await serviceService.updateStatus(created.id, "active");

      expect(result.status).toBe(ServiceStatus.ACTIVE);
    });

    it("应该能恢复一个被删除的服务", async () => {
      const dto: CreateServiceDto = {
        code: `RESTORE-${Date.now()}`,
        serviceType: ServiceType.RECOMMENDATION_LETTER_ONLINE,
        name: "在线推荐信",
        billingMode: BillingMode.ONE_TIME,
      };

      const created = await serviceService.create(dto, testUserId);
      createdServiceIds.push(created.id);

      // 先删除
      await serviceService.remove(created.id);

      // 再恢复
      const result = await serviceService.restore(created.id);

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });
  });

  describe("生成快照 (generateSnapshot)", () => {
    it("应该能生成服务的快照", async () => {
      const dto: CreateServiceDto = {
        code: `SNAPSHOT-${Date.now()}`,
        serviceType: ServiceType.RECOMMENDATION_LETTER,
        name: "推荐信服务",
        description: "专业推荐信撰写",
        billingMode: BillingMode.ONE_TIME,
        metadata: {
          features: ["学术推荐", "工作推荐"],
          duration: 5,
        },
      };

      const created = await serviceService.create(dto, testUserId);
      createdServiceIds.push(created.id);

      const snapshot = await serviceService.generateSnapshot(created.id);

      expect(snapshot).toBeDefined();
      expect(snapshot.serviceId).toBe(created.id);
      expect(snapshot.serviceCode).toBe(dto.code);
      expect(snapshot.serviceName).toBe(dto.name);
      expect(snapshot.serviceType).toBe(dto.serviceType);
    });
  });
});
