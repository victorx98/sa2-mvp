import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServiceService } from "./service.service";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  createTestFixtures,
  TestFixtures,
} from "../../../../../test/utils/test-fixtures";
import {
  CatalogException,
  CatalogNotFoundException,
  CatalogConflictException,
  CatalogGoneException,
} from "../../common/exceptions/catalog.exception";
import {
  ServiceType,
  BillingMode,
  ServiceUnit,
  ServiceStatus,
} from "../../common/interfaces/enums";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

describe("ServiceService (Integration with Real Database)", () => {
  let moduleRef: TestingModule;
  let service: ServiceService;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;
  let testUserId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
      ],
      providers: [ServiceService],
    }).compile();

    service = moduleRef.get<ServiceService>(ServiceService);
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);

    // Clean up any existing test data first
    await fixtures.cleanupAll();

    // Create test user
    const user = await fixtures.createUser();
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up all test data
    await fixtures.cleanupAll();

    await moduleRef.close();
  });

  afterEach(async () => {
    // Clean up catalog data after each test to avoid unique constraint violations
    await fixtures.cleanupAllCatalogData();
  });

  describe("create", () => {
    it("should successfully create a service", async () => {
      const createDto = {
        code: `resume_review_${Date.now()}`,
        serviceType: ServiceType.RESUME_REVIEW,
        name: "Resume Review Service",
        description: "Professional resume review by experts",
        billingMode: BillingMode.ONE_TIME,
        defaultUnit: ServiceUnit.TIMES,
        requiresEvaluation: false,
        requiresMentorAssignment: true,
        metadata: {
          features: ["1-on-1 service", "Delivered within 72 hours"],
          deliverables: ["Updated resume document"],
        },
      };

      const result = await service.create(createDto, testUserId);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe(createDto.code);
      expect(result.status).toBe(ServiceStatus.ACTIVE);
      expect(result.createdBy).toBe(testUserId);
      expect(result.serviceType).toBe(ServiceType.RESUME_REVIEW);
    });

    it("should reject duplicate service code", async () => {
      const code = `unique_code_${Date.now()}`;
      await fixtures.createService(testUserId, {
        code,
        serviceType: ServiceType.GAP_ANALYSIS,
      });

      const createDto = {
        code,
        serviceType: ServiceType.MOCK_INTERVIEW,
        name: "Another Service",
        billingMode: BillingMode.ONE_TIME,
        defaultUnit: ServiceUnit.TIMES,
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogConflictException,
      );
    });

    it("should reject duplicate service type", async () => {
      await fixtures.createService(testUserId, {
        code: `code_${Date.now()}`,
        serviceType: ServiceType.SESSION,
      });

      const createDto = {
        code: `another_code_${Date.now()}`,
        serviceType: ServiceType.SESSION,
        name: "1-on-1 Session",
        billingMode: BillingMode.PER_SESSION,
        defaultUnit: ServiceUnit.HOURS,
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogConflictException,
      );
    });
  });

  describe("update", () => {
    it("should successfully update a service", async () => {
      const existingService = await fixtures.createService(testUserId, {
        name: "Original Name",
        description: "Original Description",
      });

      const updateDto = {
        name: "Updated Name",
        description: "Updated Description",
      };

      const result = await service.update(existingService.id, updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it("should reject updating non-existent service", async () => {
      const updateDto = { name: "Updated Name" };

      await expect(
        service.update("00000000-0000-0000-0000-000000000000", updateDto),
      ).rejects.toThrow(CatalogNotFoundException);
    });

    it("should reject updating deleted service", async () => {
      const deletedService = await fixtures.createService(testUserId, {
        status: "deleted",
      });

      const updateDto = { name: "Updated Name" };

      await expect(
        service.update(deletedService.id, updateDto),
      ).rejects.toThrow(CatalogGoneException);
    });
  });

  describe("findOne", () => {
    it("should find service by ID", async () => {
      const existingService = await fixtures.createService(testUserId);

      const result = await service.findOne({ id: existingService.id });

      expect(result).toBeDefined();
      expect(result?.id).toBe(existingService.id);
    });

    it("should find service by code", async () => {
      const code = `findable_code_${Date.now()}`;
      const _existingService = await fixtures.createService(testUserId, {
        code,
      });

      const result = await service.findOne({ code });

      expect(result).toBeDefined();
      expect(result?.code).toBe(code);
    });

    it("should return null when service not found", async () => {
      const result = await service.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });

    it("should require at least one query parameter", async () => {
      await expect(service.findOne({})).rejects.toThrow(CatalogException);
    });
  });

  describe("updateStatus", () => {
    it("should successfully update service status to inactive", async () => {
      const existingService = await fixtures.createService(testUserId, {
        status: "active",
      });

      const result = await service.updateStatus(existingService.id, "inactive");

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });

    it("should successfully update service status to active", async () => {
      const existingService = await fixtures.createService(testUserId, {
        status: "inactive",
      });

      const result = await service.updateStatus(existingService.id, "active");

      expect(result.status).toBe(ServiceStatus.ACTIVE);
    });
  });

  describe("remove", () => {
    it("should reject deleting active service", async () => {
      const activeService = await fixtures.createService(testUserId, {
        status: "active",
      });

      await expect(service.remove(activeService.id)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject deleting referenced service", async () => {
      const inactiveService = await fixtures.createService(testUserId, {
        status: "inactive",
      });

      // Create a service package referencing this service
      await fixtures.createServicePackage(testUserId, [inactiveService.id]);

      await expect(service.remove(inactiveService.id)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should successfully delete unreferenced inactive service", async () => {
      const inactiveService = await fixtures.createService(testUserId, {
        status: "inactive",
      });

      const result = await service.remove(inactiveService.id);

      expect(result.status).toBe(ServiceStatus.DELETED);
    });
  });

  describe("restore", () => {
    it("should successfully restore deleted service", async () => {
      const deletedService = await fixtures.createService(testUserId, {
        status: "deleted",
      });

      const result = await service.restore(deletedService.id);

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });

    it("should reject restoring non-deleted service", async () => {
      const activeService = await fixtures.createService(testUserId, {
        status: "active",
      });

      await expect(service.restore(activeService.id)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("generateSnapshot", () => {
    it("should successfully generate service snapshot", async () => {
      const existingService = await fixtures.createService(testUserId, {
        name: "Test Service",
        metadata: {
          features: ["Feature 1"],
        },
      });

      const snapshot = await service.generateSnapshot(existingService.id);

      expect(snapshot).toBeDefined();
      expect(snapshot.serviceId).toBe(existingService.id);
      expect(snapshot.serviceName).toBe(existingService.name);
      expect(snapshot.serviceCode).toBe(existingService.code);
      expect(snapshot.snapshotAt).toBeDefined();
    });

    it("should reject generating snapshot for non-existent service", async () => {
      await expect(
        service.generateSnapshot("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(CatalogNotFoundException);
    });
  });

  describe("search", () => {
    beforeAll(async () => {
      // Clean up existing services to avoid unique constraint violations
      await db.delete(schema.servicePackageItems);
      await db.delete(schema.servicePackages);
      await db.delete(schema.services);

      // Create multiple services for search testing
      await fixtures.createServices(testUserId, 5, { status: "active" });
    });

    it("should search services with pagination", async () => {
      const filters = {};
      const pagination = { page: 1, pageSize: 2 };

      const result = await service.search(filters, pagination);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it("should filter services by status", async () => {
      const filters = { status: ServiceStatus.ACTIVE };

      const result = await service.search(filters);

      expect(result.data.every((s) => s.status === ServiceStatus.ACTIVE)).toBe(
        true,
      );
    });

    it("should filter services by billing mode", async () => {
      const filters = { billingMode: BillingMode.ONE_TIME };

      const result = await service.search(filters);

      expect(
        result.data.every((s) => s.billingMode === BillingMode.ONE_TIME),
      ).toBe(true);
    });
  });

  describe("findAvailableServices", () => {
    it("should return only active services", async () => {
      const result = await service.findAvailableServices();

      expect(Array.isArray(result)).toBe(true);
      expect(result.every((s) => s.status === ServiceStatus.ACTIVE)).toBe(true);
    });
  });
});
