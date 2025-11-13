import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ServicePackageService } from "./service-package.service";
import { ServiceService } from "../../service/services/service.service";
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
import { ServiceStatus, ProductItemType } from "../../common/interfaces/enums";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

// Increase default timeout for integration tests
jest.setTimeout(60000);

describe("ServicePackageService (Integration with Real Database)", () => {
  let moduleRef: TestingModule;
  let service: ServicePackageService;
  let _serviceService: ServiceService;
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
      providers: [ServicePackageService, ServiceService],
    }).compile();

    service = moduleRef.get<ServicePackageService>(ServicePackageService);
    _serviceService = moduleRef.get<ServiceService>(ServiceService);
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);

    // Clean up any existing test data first
    await fixtures.cleanupAll();

    // Create test user
    const user = await fixtures.createUser();
    testUserId = user.id;
  }, 30000); // Increase timeout for beforeAll hook

  afterAll(async () => {
    // Clean up all test data
    await fixtures.cleanupAll();

    await moduleRef.close();
  }, 30000); // Increase timeout for afterAll hook

  afterEach(async () => {
    // Clean up catalog data after each test to avoid unique constraint violations
    await fixtures.cleanupAllCatalogData();
  });

  describe("create", () => {
    it("should successfully create a service package", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });

      const createDto = {
        code: `basic_package_${Date.now()}`,
        name: "Basic Job Seeking Package",
        description: "Contains essential job seeking services",
        metadata: {
          features: [
            "Covers basic job seeking services",
            "Suitable for beginners",
          ],
        },
        items: [
          {
            serviceId: services[0].id,
            quantity: 1,
            sortOrder: 0,
          },
          {
            serviceId: services[1].id,
            quantity: 3,
            sortOrder: 1,
          },
        ],
      };

      const result = await service.create(createDto, testUserId);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.code).toBe(createDto.code);
      expect(result.status).toBe(ServiceStatus.ACTIVE);
      expect(result.createdBy).toBe(testUserId);
    });

    it("should reject duplicate service package code", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const code = `unique_package_${Date.now()}`;

      await fixtures.createServicePackage(testUserId, [services[0].id], {
        code,
      });

      const createDto = {
        code,
        name: "Another Package",
        items: [
          {
            serviceId: services[1].id,
            quantity: 1,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogConflictException,
      );
    });

    it("should reject referencing non-existent service", async () => {
      const createDto = {
        code: `invalid_package_${Date.now()}`,
        name: "Invalid Package",
        items: [
          {
            serviceId: "00000000-0000-0000-0000-000000000000",
            quantity: 1,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogNotFoundException,
      );
    });

    it("should reject referencing non-active service", async () => {
      const inactiveService = await fixtures.createService(testUserId, {
        status: "inactive",
      });

      const createDto = {
        code: `package_with_inactive_${Date.now()}`,
        name: "Package with Inactive Service",
        items: [
          {
            serviceId: inactiveService.id,
            quantity: 1,
            sortOrder: 0,
          },
        ],
      };

      await expect(service.create(createDto, testUserId)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("addService", () => {
    it("should successfully add service to package", async () => {
      const services = await fixtures.createServices(testUserId, 3, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(testUserId, [
        services[0].id,
        services[1].id,
      ]);

      const addServiceDto = {
        serviceId: services[2].id,
        quantity: 2,
        sortOrder: 2,
      };

      await service.addService(servicePackage.id, addServiceDto);

      // Verify service was added
      const updatedPackage = await service.findOne({ id: servicePackage.id });
      expect(updatedPackage?.items?.length).toBe(3);
    });

    it("should reject adding duplicate service", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(testUserId, [
        services[0].id,
        services[1].id,
      ]);

      const addServiceDto = {
        serviceId: services[0].id, // Already in package
        quantity: 1,
        sortOrder: 2,
      };

      await expect(
        service.addService(servicePackage.id, addServiceDto),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("removeService", () => {
    it("should successfully remove service from package", async () => {
      const services = await fixtures.createServices(testUserId, 3, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(testUserId, [
        services[0].id,
        services[1].id,
        services[2].id,
      ]);

      await service.removeService(servicePackage.id, services[2].id);

      // Verify service was removed
      const updatedPackage = await service.findOne({ id: servicePackage.id });
      expect(updatedPackage?.items?.length).toBe(2);
    });

    it("should reject removing last service", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(testUserId, [
        services[0].id,
      ]);

      await expect(
        service.removeService(servicePackage.id, services[0].id),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe("update", () => {
    it("should successfully update service package", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id, services[1].id],
        { name: "Original Name" },
      );

      const updateDto = {
        name: "Updated Package Name",
        description: "Updated description",
      };

      const result = await service.update(servicePackage.id, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.description).toBe(updateDto.description);
    });

    it("should reject updating non-existent package", async () => {
      const updateDto = { name: "Updated Name" };

      await expect(
        service.update("00000000-0000-0000-0000-000000000000", updateDto),
      ).rejects.toThrow(CatalogNotFoundException);
    });

    it("should reject updating deleted package", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "deleted" },
      );

      const updateDto = { name: "Updated Name" };

      await expect(
        service.update(servicePackage.id, updateDto),
      ).rejects.toThrow(CatalogGoneException);
    });
  });

  describe("remove", () => {
    it("should reject deleting active package", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "active" },
      );

      await expect(service.remove(servicePackage.id)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should reject deleting referenced package", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "inactive" },
      );

      // Create a product referencing this package
      await fixtures.createProduct(testUserId, [
        {
          type: ProductItemType.SERVICE_PACKAGE,
          referenceId: servicePackage.id,
          quantity: 1,
        },
      ]);

      await expect(service.remove(servicePackage.id)).rejects.toThrow(
        CatalogException,
      );
    });

    it("should successfully delete unreferenced inactive package", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "inactive" },
      );

      const result = await service.remove(servicePackage.id);

      expect(result.status).toBe(ServiceStatus.DELETED);
    });
  });

  describe("restore", () => {
    it("should successfully restore deleted package", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "deleted" },
      );

      const result = await service.restore(servicePackage.id);

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });

    it("should reject restoring non-deleted package", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "active" },
      );

      await expect(service.restore(servicePackage.id)).rejects.toThrow(
        CatalogException,
      );
    });
  });

  describe("findOne", () => {
    it("should find package by ID with items", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(testUserId, [
        services[0].id,
        services[1].id,
      ]);

      const result = await service.findOne({ id: servicePackage.id });

      expect(result).toBeDefined();
      expect(result?.id).toBe(servicePackage.id);
      expect(result?.items?.length).toBe(2);
    });

    it("should return null when package not found", async () => {
      const result = await service.findOne({
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });
  });

  describe("generateSnapshot", () => {
    it("should successfully generate service package snapshot", async () => {
      const services = await fixtures.createServices(testUserId, 2, {
        status: "active",
      });

      const pkg = await fixtures.createServicePackage(
        testUserId,
        [services[0].id, services[1].id],
        { status: "active" },
      );

      const result = await service.generateSnapshot(pkg.id);

      expect(result).toBeDefined();
      expect(result.packageId).toBe(pkg.id);
      expect(result.packageName).toBe(pkg.name);
      expect(result.items).toHaveLength(2);

      // Verify item structure
      const firstItem = result.items[0];
      expect(firstItem).toBeDefined();
      expect(firstItem.serviceSnapshot.serviceId).toBeDefined();
      expect(firstItem.serviceSnapshot.serviceName).toBeDefined();
      expect(firstItem.quantity).toBeGreaterThan(0);
    }, 15000); // Increase timeout for this test

    it("should reject generating snapshot for non-existent package", async () => {
      await expect(
        service.generateSnapshot("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(CatalogNotFoundException);
    });
  });

  describe("search", () => {
    beforeAll(async () => {
      // Create multiple packages for search testing
      const services = await fixtures.createServices(testUserId, 5, {
        status: "active",
      });
      for (let i = 0; i < 3; i++) {
        await fixtures.createServicePackage(testUserId, [services[i].id], {
          status: "active",
        });
      }
    });

    it("should search packages with pagination", async () => {
      const filters = {};
      const pagination = { page: 1, pageSize: 2 };

      const result = await service.search(filters, pagination);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it("should filter packages by status", async () => {
      const filters = { status: ServiceStatus.ACTIVE };

      const result = await service.search(filters);

      expect(result.data.every((p) => p.status === ServiceStatus.ACTIVE)).toBe(
        true,
      );
    });
  });

  describe("updateStatus", () => {
    it("should successfully update package status", async () => {
      const services = await fixtures.createServices(testUserId, 1, {
        status: "active",
      });
      const servicePackage = await fixtures.createServicePackage(
        testUserId,
        [services[0].id],
        { status: "active" },
      );

      const result = await service.updateStatus(servicePackage.id, "inactive");

      expect(result.status).toBe(ServiceStatus.INACTIVE);
    });
  });
});
