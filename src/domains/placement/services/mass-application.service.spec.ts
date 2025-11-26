import { Test, TestingModule } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { MassApplicationService } from "./mass-application.service";
import { ApplicationStatus } from "../types/application-status.enum";
import { CreateMassApplicationDto, CreateBatchMassApplicationDto } from "../dto/mass-application.dto";

/**
 * MassApplicationService Unit Tests [海投申请服务单元测试]
 *
 * Test Strategy:
 * - This is a UNIT test for the domain service layer
 * - Test level: Service methods in isolation with mocked dependencies
 * - Mock external dependencies: Database
 * - Focus: Business logic validation, data transformation, and transaction management
 * - Does NOT test: Database integration, trigger behaviors, cross-service orchestration
 */
describe("MassApplicationService Unit Tests [海投申请服务单元测试]", () => {
  let moduleRef: TestingModule;
  let service: MassApplicationService;
  let mockDb: any;

  const testStudentId = randomUUID();
  const testIndeedJobId = "indeed_test_job_001";
  const testJobId = "job_001";
  const testApplicationId = randomUUID();

  // Helper function to create a query chain that returns a resolved promise
  // This creates a thenable object that can be awaited
  const createMockQueryChain = (result: any) => {
    const chain: any = {
      then: jest.fn((resolve) => Promise.resolve(result).then(resolve)),
      where: jest.fn(() => chain),
      from: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      forUpdate: jest.fn(() => chain),
      offset: jest.fn(() => chain),
      orderBy: jest.fn(() => chain),
      set: jest.fn(() => chain),
      values: jest.fn(() => chain),
      returning: jest.fn(() => chain),
      execute: jest.fn(() => chain),
    };
    return chain;
  };

  beforeEach(async () => {
    // Create simpler mock database using jest.fn() for each method
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        MassApplicationService,
      ],
    }).compile();

    service = moduleRef.get<MassApplicationService>(MassApplicationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createApplication() [创建单条海投申请]", () => {
    it("should create application successfully when unique [唯一验证通过，成功创建]", async () => {
      const dto: CreateMassApplicationDto = {
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        jobId: testJobId,
        appliedAt: new Date(),
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: dto.studentId,
        indeedJobId: dto.indeedJobId,
        jobId: dto.jobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        appliedAt: dto.appliedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock unique check to return empty array (no duplicates)
      mockDb.select.mockReturnValue(createMockQueryChain([]));

      // Mock transaction to return the created application
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          insert: jest.fn(() => ({
            values: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([mockApplication]),
            })),
          })),
          select: jest.fn(() => ({
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn().mockResolvedValue([mockApplication]),
              })),
            })),
          })),
        };

        const result = await callback(mockTx);
        return result;
      });

      const result = await service.createApplication(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(testApplicationId);
      expect(result.studentId).toBe(dto.studentId);
      expect(result.indeedJobId).toBe(dto.indeedJobId);
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
      expect(result.appliedAt).toBeDefined();
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error when duplicate application exists [存在重复申请，抛出错误]", async () => {
      const dto: CreateMassApplicationDto = {
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
      };

      const existingApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
      };

      // Mock existing application[模拟已存在的申请]
      mockDb.select.mockReturnValue(createMockQueryChain([existingApplication]));

      await expect(service.createApplication(dto)).rejects.toThrow(
        `Student ${testStudentId} has already applied for job ${testIndeedJobId}`,
      );
    });
  });

  describe("createBatchApplications() [批量创建海投申请]", () => {
    it("should create all applications successfully when no duplicates [无重复，全部成功]", async () => {
      const dto: CreateBatchMassApplicationDto = {
        studentId: testStudentId,
        applications: [
          { indeedJobId: "indeed_job_001", jobId: "job_001" },
          { indeedJobId: "indeed_job_002", jobId: "job_002" },
          { indeedJobId: "indeed_job_003", jobId: "job_003" },
        ],
      };

      const mockApplications = [
        { id: randomUUID(), studentId: testStudentId, indeedJobId: "indeed_job_001", jobId: "job_001" },
        { id: randomUUID(), studentId: testStudentId, indeedJobId: "indeed_job_002", jobId: "job_002" },
        { id: randomUUID(), studentId: testStudentId, indeedJobId: "indeed_job_003", jobId: "job_003" },
      ];

      mockDb.select.mockReturnValue(createMockQueryChain([]));

      // Mock insert to return individual applications for each call
      let insertCallCount = 0;
      mockDb.insert.mockImplementation(() => {
        const app = mockApplications[insertCallCount++];
        return createMockQueryChain([app]);
      });

      // Mock database to return different applications for each call
      let callCount = 0;
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          insert: jest.fn(() => ({
            values: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([mockApplications[callCount++]]),
            })),
          })),
          select: jest.fn(() => ({
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn().mockResolvedValue([mockApplications[callCount - 1]]),
              })),
            })),
          })),
        };
        return await callback(mockTx);
      });

      const result = await service.createBatchApplications(dto);

      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.failures).toHaveLength(0);
      expect(result.applications).toHaveLength(3);
    });

    it("should handle partial failures when some applications are duplicates [部分重复，部分成功]", async () => {
      const duplicateJobId = "indeed_job_duplicate";
      const dto: CreateBatchMassApplicationDto = {
        studentId: testStudentId,
        applications: [
          { indeedJobId: duplicateJobId, jobId: "job_duplicate" }, // This will fail
          { indeedJobId: "indeed_job_unique", jobId: "job_unique" }, // This will succeed
        ],
      };

      // Mock first call returns duplicate, second returns empty
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createMockQueryChain([
            {
              id: randomUUID(),
              studentId: testStudentId,
              indeedJobId: duplicateJobId,
              applicationStatus: ApplicationStatus.SUBMITTED,
            },
          ]);
        }
        return createMockQueryChain([]);
      });

      // Mock insert to return the successful application
      mockDb.insert.mockReturnValue(createMockQueryChain([
        {
          id: randomUUID(),
          studentId: testStudentId,
          indeedJobId: "indeed_job_unique",
          jobId: "job_unique",
          applicationStatus: ApplicationStatus.SUBMITTED,
          appliedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]));

      const mockTx = {
        insert: jest.fn(() => ({
          values: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([
              {
                id: randomUUID(),
                studentId: testStudentId,
                indeedJobId: "indeed_job_unique",
                jobId: "job_unique",
                applicationStatus: ApplicationStatus.SUBMITTED,
                appliedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          })),
        })),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([
                {
                  id: randomUUID(),
                  studentId: testStudentId,
                  indeedJobId: "indeed_job_unique",
                  jobId: "job_unique",
                  applicationStatus: ApplicationStatus.SUBMITTED,
                  appliedAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
            })),
          })),
        })),
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const result = await service.createBatchApplications(dto);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].indeedJobId).toBe(duplicateJobId);
      expect(result.applications).toHaveLength(1);
    });
  });

  describe("updateApplicationStatus() [更新申请状态]", () => {
    it("should update status successfully when transition is valid [状态流转合法，更新成功]", async () => {
      const applicationId = testApplicationId;
      const originalApplication = {
        id: applicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedApplication = {
        ...originalApplication,
        applicationStatus: ApplicationStatus.INTERVIEWED,
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue(createMockQueryChain([originalApplication]));

      mockDb.transaction.mockImplementation(async () => {
        return [updatedApplication]; // Return array for destructuring
      });

      const result = await service.updateApplicationStatus({
        applicationId,
        newStatus: ApplicationStatus.INTERVIEWED,
        updatedBy: "counselor_001",
      });

      expect(result.status).toBe(ApplicationStatus.INTERVIEWED);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw error when application not found [申请不存在，抛出错误]", async () => {
      mockDb.select.mockReturnValue(createMockQueryChain([]));

      await expect(
        service.updateApplicationStatus({
          applicationId: testApplicationId,
          newStatus: ApplicationStatus.INTERVIEWED,
          updatedBy: "counselor_001",
        }),
      ).rejects.toThrow(`Application not found: ${testApplicationId}`);
    });

    it("should throw error when status transition is invalid [状态流转非法，抛出错误]", async () => {
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
      };

      mockDb.select.mockReturnValue(createMockQueryChain([mockApplication]));

      // Try to transition from SUBMITTED to OFFERED (invalid)
      await expect(
        service.updateApplicationStatus({
          applicationId: testApplicationId,
          newStatus: ApplicationStatus.OFFERED,
          updatedBy: "counselor_001",
        }),
      ).rejects.toThrow(
        `Invalid status transition from ${ApplicationStatus.SUBMITTED} to ${ApplicationStatus.OFFERED}`,
      );
    });
  });

  describe("getApplicationById() [根据ID获取申请]", () => {
    it("should return application when found [找到申请，成功返回]", async () => {
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        jobId: testJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue(createMockQueryChain([mockApplication]));

      const result = await service.getApplicationById(testApplicationId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testApplicationId);
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
    });

    it("should throw error when application not found [申请不存在，抛出错误]", async () => {
      mockDb.select.mockReturnValue(createMockQueryChain([]));

      await expect(service.getApplicationById(testApplicationId)).rejects.toThrow(
        `Application not found: ${testApplicationId}`,
      );
    });
  });

  describe("queryApplications() [查询申请列表]", () => {
    it("should query applications with filters [带筛选条件查询]", async () => {
      const mockApplications = [
        {
          id: randomUUID(),
          studentId: testStudentId,
          indeedJobId: "indeed_job_001",
          applicationStatus: ApplicationStatus.SUBMITTED,
          appliedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          studentId: testStudentId,
          indeedJobId: "indeed_job_002",
          applicationStatus: ApplicationStatus.INTERVIEWED,
          appliedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValue(createMockQueryChain(mockApplications));

      const result = await service.queryApplications({
        studentId: testStudentId,
        status: ApplicationStatus.SUBMITTED,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.limit).toBe(10);
    });
  });

  describe("getApplicationStats() [获取申请统计]", () => {
    it("should return application statistics [返回申请统计数据]", async () => {
      const mockApplications = [
        {
          studentId: testStudentId,
          applicationStatus: ApplicationStatus.SUBMITTED,
          appliedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          studentId: testStudentId,
          applicationStatus: ApplicationStatus.INTERVIEWED,
          appliedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValue(createMockQueryChain(mockApplications));

      const result = await service.getApplicationStats(testStudentId);

      expect(result.studentId).toBe(testStudentId);
      expect(result.totalApplications).toBe(2);
      expect(result.statusBreakdown[ApplicationStatus.SUBMITTED]).toBe(1);
      expect(result.statusBreakdown[ApplicationStatus.INTERVIEWED]).toBe(1);
      expect(result.recentApplications).toHaveLength(2);
    });
  });

  describe("canApply() [验证是否可以申请]", () => {
    it("should return true when student can apply [可以申请，返回true]", async () => {
      mockDb.select.mockReturnValue(createMockQueryChain([]));

      const result = await service.canApply(testStudentId, testIndeedJobId);

      expect(result).toBe(true);
    });

    it("should return false when student cannot apply [不可申请，返回false]", async () => {
      const existingApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
      };

      mockDb.select.mockReturnValue(createMockQueryChain([existingApplication]));

      const result = await service.canApply(testStudentId, testIndeedJobId);

      expect(result).toBe(false);
    });
  });

  describe("applicationExists() [检查申请是否存在]", () => {
    it("should return true when application exists [申请存在，返回true]", async () => {
      mockDb.select.mockReturnValue(createMockQueryChain([
        {
          id: testApplicationId,
          studentId: testStudentId,
          indeedJobId: testIndeedJobId,
        },
      ]));

      const result = await service.applicationExists(testApplicationId);

      expect(result).toBe(true);
    });

    it("should return false when application does not exist [申请不存在，返回false]", async () => {
      mockDb.select.mockReturnValue(createMockQueryChain([]));

      const result = await service.applicationExists(testApplicationId);

      expect(result).toBe(false);
    });
  });

  describe("processApplicationRejection() [处理申请拒绝]", () => {
    it("should process rejection successfully [成功处理拒绝]", async () => {
      const originalApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rejectedApplication = {
        ...originalApplication,
        applicationStatus: ApplicationStatus.REJECTED,
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue(createMockQueryChain([originalApplication]));

      mockDb.transaction.mockImplementation(async () => {
        return [rejectedApplication]; // Return array for destructuring
      });

      const result = await service.processApplicationRejection({
        applicationId: testApplicationId,
        rejectedBy: "counselor_001",
      });

      expect(result.status).toBe(ApplicationStatus.REJECTED);
    });
  });

  describe("processInterviewInvitation() [处理面试邀请]", () => {
    it("should process interview invitation successfully [成功处理面试邀请]", async () => {
      const originalApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const offeredApplication = {
        ...originalApplication,
        applicationStatus: ApplicationStatus.INTERVIEWED,
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue(createMockQueryChain([originalApplication]));

      const mockTx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([offeredApplication]),
          })),
        })),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([offeredApplication]),
            })),
          })),
        })),
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        await callback(mockTx);
        return [offeredApplication];
      });

      const result = await service.processInterviewInvitation({
        applicationId: testApplicationId,
        interviewDate: new Date(),
        invitedBy: "counselor_001",
      });

      expect(result.status).toBe(ApplicationStatus.INTERVIEWED);
    });
  });

  describe("processOfferReceived() [处理收到offer]", () => {
    it("should process offer successfully [成功处理offer]", async () => {
      const originalApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.INTERVIEWED,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const offeredApplication = {
        ...originalApplication,
        applicationStatus: ApplicationStatus.OFFERED,
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue(createMockQueryChain([originalApplication]));

      const mockTx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([offeredApplication]),
          })),
        })),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([offeredApplication]),
            })),
          })),
        })),
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        await callback(mockTx);
        return [offeredApplication];
      });

      const result = await service.processOfferReceived({
        applicationId: testApplicationId,
        offeredBy: "counselor_001",
      });

      expect(result.status).toBe(ApplicationStatus.OFFERED);
    });
  });

  describe("expireApplication() [使申请过期]", () => {
    it("should expire application successfully [成功使申请过期]", async () => {
      const originalApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        indeedJobId: testIndeedJobId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const offeredApplication = {
        ...originalApplication,
        applicationStatus: ApplicationStatus.EXPIRED,
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue(createMockQueryChain([originalApplication]));

      const mockTx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([offeredApplication]),
          })),
        })),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([offeredApplication]),
            })),
          })),
        })),
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        await callback(mockTx);
        return [offeredApplication];
      });

      const result = await service.expireApplication({
        applicationId: testApplicationId,
        expiryReason: "Job expired",
        expiredBy: "system",
      });

      expect(result.status).toBe(ApplicationStatus.EXPIRED);
    });
  });
});
