import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { JobApplicationService } from "./job-application.service";
import {
  IRecommendReferralApplicationsBatchDto,
  ISubmitApplicationDto,
  IUpdateApplicationStatusDto,
  ICreateManualJobApplicationDto,
} from "@api/dto/request/placement/placement.index";
import { ApplicationType } from "../types/application-type.enum";
import { randomUUID } from "crypto";
import {
  IntegrationEventPublisher,
  JobApplicationStatusChangedEvent,
  JobApplicationStatusRolledBackEvent,
  PlacementApplicationSubmittedEvent,
} from "@application/events";

/**
 * Unit Tests for JobApplicationService
 * [JobApplicationService 单元测试]
 *
 * Test Strategy:
 * - This is a UNIT test for the domain service layer
 * - Test level: Service methods in isolation with mocked dependencies
 * - Mock external dependencies: Database
 * - Focus: Business logic validation (application submission, status changes, querying, etc.)
 * - Does NOT test: Database operations, event publishing, external service calls
 */
describe("JobApplicationService Unit Tests [投递服务单元测试]", () => {
  let moduleRef: TestingModule;
  let jobApplicationService: JobApplicationService;
  let mockDb: any;
  let mockEventPublisher: { publish: jest.Mock };
  const testApplicationId = randomUUID();
  const testStudentId = "bc9c587e-8206-4b93-9e2c-fdc92d13f40b";
  const testJobId = randomUUID(); // Changed to UUID string to match new schema [改为UUID字符串以匹配新schema]
  const testMentorId = "70394110-4442-4004-a89e-e4bc2d6b030e";

  beforeEach(async () => {
    // Create a simple mock that directly returns a promise resolving to an array
    // This simulates how Drizzle ORM's query builder works when awaited
    mockDb = {
      select: jest.fn(() => {
        return {
          from: jest.fn(() => {
            return {
              where: jest.fn(() => {
                return {
                  // Support chaining orderBy after where
                  orderBy: jest.fn(() => Promise.resolve([])),
                  // Support await on the result
                  then: jest.fn((resolve) => resolve([])),
                };
              }),
              limit: jest.fn(() => {
                return {
                  offset: jest.fn(() => Promise.resolve([])),
                };
              }),
              orderBy: jest.fn(() => Promise.resolve([])),
              returning: jest.fn(() => Promise.resolve([])),
            };
          }),
        };
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
      delete: jest.fn(),
      transaction: jest.fn(async (callback) => {
        return await callback(mockDb);
      }),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
      ],
      providers: [
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: IntegrationEventPublisher,
          useValue: mockEventPublisher,
        },
        JobApplicationService,
      ],
    }).compile();

    jobApplicationService = moduleRef.get<JobApplicationService>(
      JobApplicationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("submitApplication() [提交投递申请]", () => {
    it("should submit application successfully [应该成功提交投递申请]", async () => {
      // Arrange [准备]
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: ApplicationType.DIRECT,

      };

      const createdApplication = {
        id: testApplicationId,
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: dto.applicationType,
        
        status: "submitted",
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the database operations
      // First call (lines 81-84): query recommendedJobs for job existence check
      // Second call (inside checkDuplicateApplication): query jobApplications for duplicate check
      let selectCallCount = 0;
      mockDb.select = jest.fn((_columns?: any) => {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => {
              selectCallCount++;
              // First call: job existence check - return job
              // Second call: duplicate check - return empty array
              return Promise.resolve(
                selectCallCount === 1
                  ? [{ id: testJobId, status: "active", title: "Test Job", jobLink: "https://example.com/job" }]
                  : [],
              );
            }),
          })),
        };
      });

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([createdApplication]),
        })),
      }));

      // Mock update for incrementing application count
      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn().mockResolvedValue([]),
        })),
      }));

      // Act [执行]
      const result = await jobApplicationService.submitApplication(dto);

      // Assert [断言]
      expect(result.data).toEqual(createdApplication);
      expect(result.event).toBeDefined();
      expect(result.event?.type).toBe(JobApplicationStatusChangedEvent.eventType);
      expect(mockDb.insert).toHaveBeenCalled();

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.any(Object),
        }),
        JobApplicationService.name,
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            id: testApplicationId,
            service_type: "job_application",
            student_user_id: testStudentId,
            provider_user_id: testStudentId,
            consumed_units: 1,
            unit_type: "count",
            title: "Test Job",
          }),
        }),
        JobApplicationService.name,
      );
    });

    it("should throw error if duplicate application exists [如果存在重复申请应该抛出错误]", async () => {
      // Arrange [准备]
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: ApplicationType.DIRECT,

      };

      // Mock duplicate application found - first call returns job (existence check), second call returns duplicate
      let selectCallCount = 0;
      mockDb.select = jest.fn((_columns?: any) => {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => {
              selectCallCount++;
              // First call: job existence check - return job
              // Second call: duplicate check - return existing application
              return Promise.resolve(
                selectCallCount === 1
                  ? [{ id: testJobId, status: "active", title: "Test Job", jobLink: "https://example.com/job" }]
                  : [{ id: testApplicationId }],
              );
            }),
          })),
        };
      });

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.submitApplication(dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if job not found [如果岗位未找到应该抛出NotFoundException]", async () => {
      // Arrange [准备]
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: ApplicationType.DIRECT,

      };

      // Mock no job found
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            // Return empty array for duplicate check, then empty array for job existence check
            return Promise.resolve([]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.submitApplication(dto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if job is not active [如果岗位非active应该抛出BadRequestException]", async () => {
      // Arrange [准备]
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: ApplicationType.DIRECT,

      };

      // Mock job found but not active
      mockDb.select = jest.fn((_columns?: any) => {
        return {
          from: jest.fn((table: any) => ({
            where: jest.fn(() => {
              const isJobApplicationsTable = table && table[Symbol.for('drizzle:Name')] === 'job_applications';
              // First call: duplicate check on job_applications - return empty
              // Second call: job existence check on recommended_jobs - return job with inactive status
              return Promise.resolve(
                isJobApplicationsTable
                  ? []
                  : [{ id: testJobId, status: "inactive" }]
              );
            }),
          })),
        };
      });

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.submitApplication(dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("recommendReferralApplicationsBatch() [批量内推推荐]", () => {
    it("should throw BadRequestException when studentIds is empty", async () => {
      const dto: IRecommendReferralApplicationsBatchDto = {
        recommendedBy: testMentorId,
        studentIds: [],
        jobIds: [testJobId],
      };

      await expect(
        jobApplicationService.recommendReferralApplicationsBatch(dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when jobIds is empty", async () => {
      const dto: IRecommendReferralApplicationsBatchDto = {
        recommendedBy: testMentorId,
        studentIds: [testStudentId],
        jobIds: [],
      };

      await expect(
        jobApplicationService.recommendReferralApplicationsBatch(dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create applications for all studentId x jobId pairs (all-or-nothing)", async () => {
      const studentIds = [testStudentId, randomUUID()];
      const jobIds = [testJobId, randomUUID()];

      mockDb.select = jest
        .fn()
        // jobs validation query returns all jobIds as active [岗位校验：全部存在且active]
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() =>
              Promise.resolve(jobIds.map((id) => ({ id, status: "active" }))),
            ),
          })),
        })
        // duplicates query returns empty [重复校验：无重复]
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([])),
          })),
        });

      const inserted = studentIds.flatMap((studentId) =>
        jobIds.map((jobId) => ({
          id: randomUUID(),
          studentId,
          jobId,
          applicationType: "referral",
          status: "recommended",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      const historyInsert = jest.fn().mockResolvedValue([]);
      mockDb.insert = jest
        .fn()
        // insert job_applications
        .mockImplementationOnce(() => ({
          values: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue(inserted),
          })),
        }))
        // insert application_history
        .mockImplementationOnce(() => ({
          values: historyInsert,
        }));

      const dto: IRecommendReferralApplicationsBatchDto = {
        recommendedBy: testMentorId,
        studentIds,
        jobIds,
      };

      const result =
        await jobApplicationService.recommendReferralApplicationsBatch(dto);

      expect(result.data.items).toHaveLength(studentIds.length * jobIds.length);
      expect(historyInsert).toHaveBeenCalledTimes(1);
    });

    it("should throw BadRequestException when any duplicate exists (all-or-nothing)", async () => {
      const studentIds = [testStudentId];
      const jobIds = [testJobId];

      mockDb.select = jest
        .fn()
        // jobs validation ok
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() =>
              Promise.resolve(jobIds.map((id) => ({ id, status: "active" }))),
            ),
          })),
        })
        // duplicates found
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() =>
              Promise.resolve([{ studentId: testStudentId, jobId: testJobId }]),
            ),
          })),
        });

      const dto: IRecommendReferralApplicationsBatchDto = {
        recommendedBy: testMentorId,
        studentIds,
        jobIds,
      };

      await expect(
        jobApplicationService.recommendReferralApplicationsBatch(dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateApplicationStatus() [更新投递状态]", () => {
    it("should update application status successfully [应该成功更新投递状态]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "interviewed",
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted",
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockApplication]);
          }),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedApplication]),
          })),
        })),
      }));

      // Act [执行]
      const result = await jobApplicationService.updateApplicationStatus(dto);

      // Assert [断言]
      expect(result.data).toEqual(updatedApplication);
      expect(result.event).toBeDefined();
      expect(result.event?.type).toBe("placement.application.status_changed");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should not clear assignedMentorId when mentorId is not provided [未提供mentorId时不应清空assignedMentorId]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "interviewed",
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted",
        assignedMentorId: testMentorId, // Existing mentor assignment
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
        assignedMentorId: testMentorId, // Should remain unchanged
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockApplication]);
          }),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn((updateData) => {
          // Verify assignedMentorId is not in updateData (should remain unchanged)
          expect(updateData).not.toHaveProperty("assignedMentorId");
          return {
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([updatedApplication]),
            })),
          };
        }),
      }));

      // Act [执行]
      await jobApplicationService.updateApplicationStatus(dto);

      // Assert [断言]
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should update assignedMentorId when mentorId is explicitly provided [显式提供mentorId时应更新assignedMentorId]", async () => {
      // Arrange [准备]
      const newMentorId = randomUUID();
      const dto: any = {
        applicationId: testApplicationId,
        status: "mentor_assigned",
        mentorId: newMentorId, // Explicitly provide mentorId
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: "referral",
        status: "interested",
        assignedMentorId: testMentorId, // Existing mentor
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
        assignedMentorId: newMentorId, // Should be updated
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockApplication]);
          }),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn((updateData) => {
          // Verify assignedMentorId is updated
          expect(updateData.assignedMentorId).toBe(newMentorId);
          return {
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([updatedApplication]),
            })),
          };
        }),
      }));

      // Act [执行]
      await jobApplicationService.updateApplicationStatus(dto);

      // Assert [断言]
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            assignedMentorId: newMentorId,
          }),
        }),
        JobApplicationService.name,
      );
    });

    it("should allow mentor_assigned -> submitted without mentorId and screeningResult [允许mentor_assigned->submitted不传mentorId和评估结果]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "submitted",
        // mentorId is omitted; API may be status-only [未传mentorId；API可能仅做状态更新]
        // changeMetadata.screeningResult is omitted by design [按需求不传评估结果]
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: "referral",
        status: "mentor_assigned",
        assignedMentorId: testMentorId,
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
        updatedAt: new Date(),
      };

      mockDb.select = jest
        .fn()
        // First select: load application [第一次查询：获取申请]
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([mockApplication])),
          })),
        });

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedApplication]),
          })),
        })),
      }));

      // Act [执行]
      const result = await jobApplicationService.updateApplicationStatus(dto);

      // Assert [断言]
      expect(result.data).toEqual(updatedApplication);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "placement.application.status_changed",
          payload: expect.objectContaining({
            applicationId: testApplicationId,
            newStatus: "submitted",
          }),
        }),
        JobApplicationService.name,
      );
    });

    it("should allow recommended -> revoked [允许recommended->revoked]", async () => {
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "revoked",
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "recommended",
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([mockApplication])),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedApplication]),
          })),
        })),
      }));

      const result = await jobApplicationService.updateApplicationStatus(dto);
      expect(result.data).toEqual(updatedApplication);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should allow interested -> revoked [允许interested->revoked]", async () => {
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "revoked",
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "interested",
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([mockApplication])),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedApplication]),
          })),
        })),
      }));

      const result = await jobApplicationService.updateApplicationStatus(dto);
      expect(result.data).toEqual(updatedApplication);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw BadRequestException when assigning mentor for non-referral application [非内推申请分配导师应抛出BadRequestException]", async () => {
      // Arrange [准备]
      const newMentorId = randomUUID();
      const dto: any = {
        applicationId: testApplicationId,
        status: "mentor_assigned",
        mentorId: newMentorId, // Explicitly provide mentorId to trigger the check
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: "direct",
        status: "interested",
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([mockApplication])),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(jobApplicationService.updateApplicationStatus(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should update application status when reaching terminal state [终态时应成功更新投递状态]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "got_offer",
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "interviewed",
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.status,
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockApplication]);
          }),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedApplication]),
          })),
        })),
      }));

      // Act [执行]
      const result = await jobApplicationService.updateApplicationStatus(dto);

      // Assert [断言]
      expect(result.data).toEqual(updatedApplication);
      expect(result.event).toBeDefined();
      expect(result.event?.type).toBe("placement.application.status_changed");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException if application not found [如果申请未找到应该抛出NotFoundException]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "interviewed",
      };

      // Mock no application found
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.updateApplicationStatus(dto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException for invalid status transition [对于无效状态转换应该抛出BadRequestException]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        status: "got_offer",
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted", // submitted -> got_offer is not allowed according to new rules
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockApplication]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.updateApplicationStatus(dto),
      ).rejects.toThrow(/Invalid status transition/);
    });
  });

  describe("search() [搜索投递申请]", () => {
    it("should search applications with filters [应该使用筛选条件搜索投递申请]", async () => {
      // Arrange [准备]
      const filter = {
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted" as const,
        applicationType: ApplicationType.DIRECT,
      };

      const pagination = {
        page: 1,
        pageSize: 10,
      };

      const sort = {
        field: "createdAt",
        direction: "desc" as const,
      };

      const mockApplications = [
        {
          id: testApplicationId,
          studentId: testStudentId,
          jobId: testJobId,
          status: "submitted",
          applicationType: "direct",
          createdAt: new Date(),
        },
      ];

      const mockCountResult = [{ count: 1 }];

      mockDb.select = jest.fn((_columns?: any) => {
        if (_columns && _columns.count) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => {
                return Promise.resolve(mockCountResult);
              }),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn().mockResolvedValue(mockApplications),
                })),
              })),
            })),
          })),
        };
      });

      // Act [执行]
      const result = await jobApplicationService.search(
        filter,
        pagination,
        sort,
      );

      // Assert [断言]
      expect(result.items).toEqual(mockApplications);
      expect(result.total).toBe(1);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(10);
    });

    it("should return empty array if no applications found [如果没有找到投递申请应该返回空数组]", async () => {
      // Arrange [准备]
      const filter = {
        studentId: testStudentId,
      };

      const pagination = {
        page: 1,
        pageSize: 10,
      };

      const sort = {
        field: "createdAt",
        direction: "desc" as const,
      };

      const mockApplications: any[] = [];
      const mockCountResult = [{ count: 0 }];

      mockDb.select = jest.fn((_columns?: any) => {
        if (_columns && _columns.count) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => {
                return Promise.resolve(mockCountResult);
              }),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn().mockResolvedValue(mockApplications),
                })),
              })),
            })),
          })),
        };
      });

      // Act [执行]
      const result = await jobApplicationService.search(
        filter,
        pagination,
        sort,
      );

      // Assert [断言]
      expect(result.items).toEqual(mockApplications);
      expect(result.total).toBe(0);
    });

    it("should search applications with different sort orders [应该使用不同排序顺序搜索投递申请]", async () => {
      // Arrange [准备]
      const filter = {
        studentId: testStudentId,
      };

      const pagination = {
        page: 1,
        pageSize: 10,
      };

      const sort = {
        field: "status",
        direction: "asc" as const,
      };

      const mockApplications = [
        {
          id: testApplicationId,
          studentId: testStudentId,
          jobId: testJobId,
          status: "submitted",
          applicationType: "direct",
          createdAt: new Date(),
        },
      ];

      const mockCountResult = [{ count: 1 }];

      mockDb.select = jest.fn((_columns?: any) => {
        if (_columns && _columns.count) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => {
                return Promise.resolve(mockCountResult);
              }),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn().mockResolvedValue(mockApplications),
                })),
              })),
            })),
          })),
        };
      });

      // Act [执行]
      const result = await jobApplicationService.search(
        filter,
        pagination,
        sort,
      );

      // Assert [断言]
      expect(result.items).toEqual(mockApplications);
      expect(result.total).toBe(1);
    });
  });

  describe("findOne() [根据条件获取投递申请]", () => {
    it("should find application by ID successfully [应该成功根据ID获取投递申请]", async () => {
      // Arrange [准备]
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted",
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockApplication]);
          }),
        })),
      }));

      // Act [执行]
      const result = await jobApplicationService.findOne({
        id: testApplicationId,
      });

      // Assert [断言]
      expect(result).toEqual(mockApplication);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should throw NotFoundException if application not found [如果申请未找到应该抛出NotFoundException]", async () => {
      // Arrange [准备]
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.findOne({ id: testApplicationId }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getStatusHistory() [获取投递状态历史]", () => {
    it("should get status history successfully [应该成功获取投递状态历史]", async () => {
      // Arrange [准备]
      const mockHistory = [
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: null,
          newStatus: "submitted",
          changedBy: testStudentId,
          changedByType: "student",
          changeReason: "Initial submission",
          changedAt: new Date(),
        },
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: "submitted",
          newStatus: "mentor_assigned",
          changedBy: testMentorId,
          changedByType: "mentor",
          changeReason: "Moving to mentor assigned",
          changedAt: new Date(),
        },
      ];

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => {
              return Promise.resolve(mockHistory);
            }),
          })),
        })),
      }));

      // Act [执行]
      const result =
        await jobApplicationService.getStatusHistory(testApplicationId);

      // Assert [断言]
      expect(result).toEqual(mockHistory);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return empty array if no history found [如果没有找到历史记录应该返回空数组]", async () => {
      // Arrange [准备]
      const mockHistory: any[] = [];

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => {
              return Promise.resolve(mockHistory);
            }),
          })),
        })),
      }));

      // Act [执行]
      const result =
        await jobApplicationService.getStatusHistory(testApplicationId);

      // Assert [断言]
      expect(result).toEqual(mockHistory);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("rollbackApplicationStatus() [回撤申请状态到上一个状态]", () => {
    it("should rollback application status successfully [应该成功回撤申请状态]", async () => {
      // Arrange [准备]
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "interviewed",
      };

      // Status history ordered by changed_at DESC (latest first) [状态历史按changed_at降序排列（最新在前）]
      const statusHistory = [
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: "submitted",
          newStatus: "interviewed", // Latest status (matches current application status)
          changedBy: testMentorId,
          changeReason: "Moving to interview",
          changedAt: new Date(),
        },
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: null,
          newStatus: "submitted", // Previous status (to rollback to)
          changedBy: testStudentId,
          changeReason: "Initial submission",
          changedAt: new Date(Date.now() - 30000),
        },
      ];

      const updatedApplication = {
        ...mockApplication,
        status: "submitted",
      };

      // Mock database operations
      mockDb.select = jest.fn((_columns?: any) => {
        if (_columns && _columns.count) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => {
                return Promise.resolve([{ count: 1 }]);
              }),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => {
              // Return an object that supports both direct await and orderBy/limit chaining
              return {
                // For status history query with orderBy and limit
                orderBy: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve(statusHistory)),
                })),
                // For direct await (application existence check)
                then: jest.fn((resolve) => {
                  resolve([mockApplication]);
                }),
              };
            }),
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve(statusHistory)),
            })),
          })),
        };
      });

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedApplication]),
          })),
        })),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      // Act [执行]
      const result = await jobApplicationService.rollbackApplicationStatus({
        applicationId: testApplicationId,
        changedBy: testStudentId,
      });

      // Assert [断言]
      expect(result.data).toEqual(updatedApplication);
      expect(result.event).toBeDefined();
      expect(result.event?.type).toBe(JobApplicationStatusRolledBackEvent.eventType);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error if application not found [如果申请未找到应该抛出错误]", async () => {
      // Arrange [准备]
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([]);
          }),
          orderBy: jest.fn(() => {
            return Promise.resolve([]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.rollbackApplicationStatus({
          applicationId: testApplicationId,
          changedBy: testStudentId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw error if insufficient status history [如果状态历史不足应该抛出错误]", async () => {
      // Arrange [准备]
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted",
      };

      const statusHistory = [
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: null,
          newStatus: "submitted",
          changedBy: testStudentId,
          changeReason: "Initial submission",
          changedAt: new Date(),
        },
      ];

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            // Return an object that supports orderBy/limit chaining for status history query
            return {
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve(statusHistory)),
              })),
              // For direct await (application existence check)
              then: jest.fn((resolve) => {
                resolve([mockApplication]);
              }),
            };
          }),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve(statusHistory)),
          })),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.rollbackApplicationStatus({
          applicationId: testApplicationId,
          changedBy: testStudentId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if status inconsistency detected [如果检测到状态不一致应该抛出错误]", async () => {
      // Arrange [准备]
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "interviewed", // Current status
      };

      // Status history where latest status doesn't match current status [状态历史中最新状态与当前状态不匹配]
      const statusHistory = [
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: "submitted",
          newStatus: "submitted", // Doesn't match current "interviewed"
          changedBy: testMentorId,
          changeReason: "Some change",
          changedAt: new Date(),
        },
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: null,
          newStatus: "submitted",
          changedBy: testStudentId,
          changeReason: "Initial submission",
          changedAt: new Date(Date.now() - 30000),
        },
      ];

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return {
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve(statusHistory)),
              })),
              then: jest.fn((resolve) => {
                resolve([mockApplication]);
              }),
            };
          }),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve(statusHistory)),
          })),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.rollbackApplicationStatus({
          applicationId: testApplicationId,
          changedBy: testStudentId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not clear assignedMentorId when mentorId is not provided [未提供mentorId时不应清空assignedMentorId]", async () => {
      // Arrange [准备]
      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "interviewed",
        assignedMentorId: testMentorId, // Existing mentor assignment
      };

      const statusHistory = [
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: "submitted",
          newStatus: "interviewed",
          changedBy: testMentorId,
          changeReason: "Moving to interview",
          changedAt: new Date(),
        },
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: null,
          newStatus: "submitted",
          changedBy: testStudentId,
          changeReason: "Initial submission",
          changedAt: new Date(Date.now() - 30000),
        },
      ];

      const updatedApplication = {
        ...mockApplication,
        status: "submitted",
        assignedMentorId: testMentorId, // Should remain unchanged
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return {
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve(statusHistory)),
              })),
              then: jest.fn((resolve) => {
                resolve([mockApplication]);
              }),
            };
          }),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve(statusHistory)),
          })),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn((updateData) => {
          // Verify assignedMentorId is not in updateData (should remain unchanged)
          expect(updateData).not.toHaveProperty("assignedMentorId");
          return {
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([updatedApplication]),
            })),
          };
        }),
      }));

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      }));

      // Act [执行]
      await jobApplicationService.rollbackApplicationStatus({
        applicationId: testApplicationId,
        changedBy: testStudentId,
        // mentorId is not provided
      });

      // Assert [断言]
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("createManualJobApplication() [手工创建投递申请]", () => {
    it("should create manual job application successfully with mentor assigned status [应该成功创建手工投递申请，状态为mentor_assigned]", async () => {
      // Arrange [准备]
      const dto: ICreateManualJobApplicationDto = {
        studentId: testStudentId,
        mentorId: testMentorId,
        jobType: "full-time",
        resumeSubmittedDate: new Date(),
        jobTitle: "Software Engineer",
        jobLink: "https://example.com/job/123",
        jobId: "EXT-123",
        companyName: "Example Company",
        location: "San Francisco, CA",
        jobCategories: ["ADMIN"],
        normalJobTitle: "Software Engineer",
        level: "Entry Level",
        createdBy: "test-user", // Add createdBy field

      };

      const createdApplication = {
        id: testApplicationId,
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: ApplicationType.REFERRAL,
        status: "mentor_assigned",
        assignedMentorId: dto.mentorId,
        recommendedBy: "test-user", // Mock value for recommendedBy
        recommendedAt: new Date(),
        submittedAt: dto.resumeSubmittedDate,
        updatedAt: new Date(),
      };

      // Mock the database operations
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            // Return empty array for duplicate check
            return Promise.resolve([]);
          }),
        })),
      }));

      mockDb.insert = jest.fn()
        // First call: insert job_applications
        .mockImplementationOnce(() => ({
          values: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([createdApplication]),
          })),
        }))
        // Second call: insert application_history
        .mockImplementationOnce(() => ({
          values: jest.fn().mockResolvedValue([]),
        }));

      // Act [执行]
      const result = await jobApplicationService.createManualJobApplication(dto);

      // Assert [断言]
      expect(result.data).toEqual(createdApplication);
      expect(result.event).toBeDefined();
      expect(result.event?.type).toBe(JobApplicationStatusChangedEvent.eventType);
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // Insert application and history
      
      // Verify event payload
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            applicationId: createdApplication.id,
            previousStatus: null,
            newStatus: "mentor_assigned",
            changedBy: "test-user", // Mock value for changedBy
            assignedMentorId: dto.mentorId,
          }),
        }),
        JobApplicationService.name,
      );
    });

    it("should throw error if duplicate application exists [如果存在重复申请应该抛出错误]", async () => {
      // Arrange [准备]
      const testJobId = randomUUID(); // Use real UUID format for duplicate check to work [使用真正的UUID格式使重复检查生效]
      const dto: ICreateManualJobApplicationDto = {
        studentId: testStudentId,
        mentorId: testMentorId,
        jobType: "full-time",
        resumeSubmittedDate: new Date(),
        jobTitle: "Software Engineer",
        jobLink: "https://example.com/job/123",
        jobId: testJobId, // Use UUID format so duplicate check will execute [使用UUID格式以便重复检查会执行]
        companyName: "Example Company",

      };

      // Mock duplicate application found
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            // Return existing application to simulate duplicate
            return Promise.resolve([{ id: testApplicationId }]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(
        jobApplicationService.createManualJobApplication(dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should successfully create application with non-UUID jobId (skips duplicate check) [应该成功创建非UUID格式的jobId（跳过重复检查）]", async () => {
      // Arrange [准备]
      const dto: ICreateManualJobApplicationDto = {
        studentId: testStudentId,
        mentorId: testMentorId,
        jobType: "full-time",
        resumeSubmittedDate: new Date(),
        jobTitle: "Software Engineer",
        jobLink: "https://example.com/job/123",
        jobId: "EXT-123", // Non-UUID format should skip duplicate check [非UUID格式应跳过重复检查]
        companyName: "Example Company",
      };

      const createdApplication = {
        id: testApplicationId,
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: ApplicationType.REFERRAL,
        status: "mentor_assigned",
        assignedMentorId: dto.mentorId,
        recommendedBy: "test-user", // Mock value for recommendedBy
        recommendedAt: new Date(),
        submittedAt: dto.resumeSubmittedDate,
        updatedAt: new Date(),
      };

      // Mock empty for duplicate check (should be called but return empty)
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      }));

      mockDb.insert = jest.fn()
        .mockImplementationOnce(() => ({
          values: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([createdApplication]),
          })),
        }))
        .mockImplementationOnce(() => ({
          values: jest.fn().mockResolvedValue([]),
        }));

      // Act [执行]
      const result = await jobApplicationService.createManualJobApplication(dto);

      // Assert [断言]
      expect(result.data).toEqual(createdApplication);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });
});
