import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";

import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { PlacementModule } from "@domains/placement/placement.module";
import { MassApplicationService } from "@domains/placement/services/mass-application.service";
import { CreateMassApplicationDto, CreateBatchMassApplicationDto } from "@domains/placement/dto/mass-application.dto";
import { ApplicationStatus } from "@domains/placement/types/application-status.enum";
import { DrizzleDatabase } from "@shared/types/database.types";
import { applicationReferences, massApplications } from "@infrastructure/database/schema";

/**
 * Mass Application E2E Tests [海投申请集成测试]
 * Tests the complete flow of mass application operations
 * [测试海投申请操作的完整流程]
 */
describe("MassApplication E2E Tests", () => {
  let app: INestApplication;
  let service: MassApplicationService;
  let db: DrizzleDatabase;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, PlacementModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get<MassApplicationService>(MassApplicationService);
    // Get database connection for cleanup
    db = moduleFixture.get(DATABASE_CONNECTION);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.transaction(async (tx) => {
      await tx.delete(massApplications);
      await tx.delete(applicationReferences);
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // Test UUIDs for students
  const testStudentIds = {
    student1: "9e50af7d-5f08-4516-939f-7f765ce131b8",
    student2: "f2c3737c-1b37-4736-8633-251731ddcdec",
    student3: "3a3470c5-3789-4ecd-90c5-3b1a05c23e66",
    student4: "74e38690-fb47-47e8-a284-b81a7e5c42ac",
    student5: "550e8400-e29b-41d4-a716-446655440000",
    student6: "550e8400-e29b-41d4-a716-446655440001",
  };

  describe("Single Application Creation [单条申请创建]", () => {
    it("should create a mass application successfully [成功创建海投申请]", async () => {
      const dto: CreateMassApplicationDto = {
        studentId: testStudentIds.student1,
        indeedJobId: "indeed_job_001",
        jobId: "job_001",
      };

      const result = await service.createApplication(dto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.studentId).toBe(dto.studentId);
      expect(result.indeedJobId).toBe(dto.indeedJobId);
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
      expect(result.appliedAt).toBeDefined();
    });

    it("should prevent duplicate applications [阻止重复申请]", async () => {
      const dto: CreateMassApplicationDto = {
        studentId: testStudentIds.student1,
        indeedJobId: "indeed_job_002",
        jobId: "job_002",
      };

      // First application should succeed
      await service.createApplication(dto);

      // Second application should fail
      await expect(service.createApplication(dto)).rejects.toThrow();
    });
  });

  describe("Batch Application Creation [批量申请创建]", () => {
    it("should create batch applications with partial success [批量创建，部分成功]", async () => {
      const dto: CreateBatchMassApplicationDto = {
        studentId: testStudentIds.student2,
        applications: [
          { indeedJobId: "indeed_job_006", jobId: "job_006" },
          { indeedJobId: "indeed_job_007", jobId: "job_007" },
          { indeedJobId: "indeed_job_008", jobId: "job_008" },
        ],
      };

      const result = await service.createBatchApplications(dto);

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    it("should handle duplicate applications in batch [处理批量中的重复申请]", async () => {
      const studentId = testStudentIds.student3;
      const indeedJobId = "indeed_job_duplicate";

      // Create first application
      await service.createApplication({ studentId, indeedJobId });

      // Try batch with duplicate
      const dto: CreateBatchMassApplicationDto = {
        studentId,
        applications: [
          { indeedJobId, jobId: "job_duplicate" }, // This should fail
          { indeedJobId: "indeed_job_unique", jobId: "job_unique" }, // This should succeed
        ],
      };

      const result = await service.createBatchApplications(dto);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].indeedJobId).toBe(indeedJobId);
    });
  });

  describe("Status Transitions [状态流转]", () => {
    it("should transition from SUBMITTED to INTERVIEWED [从已投递到已面试]", async () => {
      const created = await service.createApplication({
        studentId: testStudentIds.student4,
        indeedJobId: "indeed_job_status_test_1",
      });

      const updated = await service.updateApplicationStatus({
        applicationId: created.id,
        newStatus: ApplicationStatus.INTERVIEWED,
        updatedBy: "counselor_001",
      });

      expect(updated.status).toBe(ApplicationStatus.INTERVIEWED);
    });

    it("should transition from INTERVIEWED to REJECTED [从已面试到已拒绝]", async () => {
      const created = await service.createApplication({
        studentId: testStudentIds.student5,
        indeedJobId: "indeed_job_status_test_2",
      });

      await service.updateApplicationStatus({
        applicationId: created.id,
        newStatus: ApplicationStatus.INTERVIEWED,
        updatedBy: "counselor_001",
      });

      const updated = await service.updateApplicationStatus({
        applicationId: created.id,
        newStatus: ApplicationStatus.REJECTED,
        updatedBy: "counselor_001",
      });

      expect(updated.status).toBe(ApplicationStatus.REJECTED);
    });

    it("should prevent invalid status transitions [阻止非法状态流转]", async () => {
      const created = await service.createApplication({
        studentId: testStudentIds.student6,
        indeedJobId: "indeed_job_status_test_3",
      });

      // Try to transition directly from SUBMITTED to OFFERED (invalid)
      await expect(
        service.updateApplicationStatus({
          applicationId: created.id,
          newStatus: ApplicationStatus.OFFERED,
          updatedBy: "counselor_001",
        }),
      ).rejects.toThrow();
    });
  });
});
