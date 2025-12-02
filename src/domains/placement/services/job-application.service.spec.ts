import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { JobApplicationService } from "./job-application.service";
import { ISubmitApplicationDto, IUpdateApplicationStatusDto } from "../dto";
import { ApplicationType } from "../types/application-type.enum";
import { randomUUID } from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT } from "../events";

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
  const testApplicationId = randomUUID();
  const testStudentId = randomUUID();
  const testJobId = randomUUID();
  const testMentorId = randomUUID();

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
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
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
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
        isUrgent: false,
      };

      const createdApplication = {
        id: testApplicationId,
        studentId: dto.studentId,
        jobId: dto.jobId,
        applicationType: dto.applicationType,
        coverLetter: dto.coverLetter,
        customAnswers: dto.customAnswers,
        status: "submitted",
        isUrgent: dto.isUrgent,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the database operations - first call (duplicate check) returns empty, second call (job existence) returns job
      let selectCallCount = 0;
      mockDb.select = jest.fn((_columns?: any) => {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => {
              selectCallCount++;
              // First call: duplicate check - return empty array
              // Second call: job existence check - return job
              return Promise.resolve(
                selectCallCount === 1 ? [] : [{ id: testJobId }],
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
      expect(result.event?.type).toBe("placement.application.status_changed");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw error if duplicate application exists [如果存在重复申请应该抛出错误]", async () => {
      // Arrange [准备]
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
        isUrgent: false,
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
        jobApplicationService.submitApplication(dto),
      ).rejects.toThrow(/already applied/);
    });

    it("should throw NotFoundException if job not found [如果岗位未找到应该抛出NotFoundException]", async () => {
      // Arrange [准备]
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: testJobId,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
        isUrgent: false,
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
  });

  describe("updateApplicationStatus() [更新投递状态]", () => {
    it("should update application status successfully [应该成功更新投递状态]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        newStatus: "interviewed",
        changedBy: testMentorId,
        changeReason: "Moving to interview",
        changeMetadata: { note: "Initial interview" },
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "submitted",
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.newStatus,
        result: null,
        resultDate: null,
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

    it("should update application status with result if applicable [如果适用应该更新投递状态并设置结果]", async () => {
      // Arrange [准备]
      const dto: IUpdateApplicationStatusDto = {
        applicationId: testApplicationId,
        newStatus: "got_offer",
        changedBy: testMentorId,
        changeReason: "Candidate got offer",
        changeMetadata: { note: "Offer received" },
      };

      const mockApplication = {
        id: testApplicationId,
        studentId: testStudentId,
        jobId: testJobId,
        status: "interviewed",
      };

      const updatedApplication = {
        ...mockApplication,
        status: dto.newStatus,
        result: null,
        resultDate: null,
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
        newStatus: "interviewed",
        changedBy: testMentorId,
        changeReason: "Moving to interviewed",
        changeMetadata: { note: "Initial interviewed" },
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
        newStatus: "got_offer",
        changedBy: testMentorId,
        changeReason: "Invalid transition",
        changeMetadata: { note: "Test invalid transition" },
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

      mockDb.select = jest.fn((columns?: any) => {
        if (columns && columns.count) {
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

      mockDb.select = jest.fn((columns?: any) => {
        if (columns && columns.count) {
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

      mockDb.select = jest.fn((columns?: any) => {
        if (columns && columns.count) {
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

      const statusHistory = [
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: null,
          newStatus: "submitted",
          changedBy: testStudentId,
          changedByType: "student",
          changeReason: "Initial submission",
          changedAt: new Date(Date.now() - 30000),
        },
        {
          id: randomUUID(),
          applicationId: testApplicationId,
          previousStatus: "submitted",
          newStatus: "interviewed",
          changedBy: testMentorId,
          changedByType: "mentor",
          changeReason: "Moving to interview",
          changedAt: new Date(),
        },
      ];

      const updatedApplication = {
        ...mockApplication,
        status: "submitted",
        result: null,
        resultDate: null,
      };

      // Mock database operations
      mockDb.select = jest.fn((columns?: any) => {
        if (columns && columns.count) {
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
              // Return an object that supports both direct await and orderBy chaining
              return {
                // For status history query with orderBy
                orderBy: jest.fn(() => {
                  return Promise.resolve(statusHistory);
                }),
                // For direct await (application existence check)
                then: jest.fn((resolve) => {
                  resolve([mockApplication]);
                }),
              };
            }),
            orderBy: jest.fn(() => {
              return Promise.resolve(statusHistory);
            }),
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
      expect(result.event?.type).toBe(JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT);
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
          changedByType: "student",
          changeReason: "Initial submission",
          changedAt: new Date(),
        },
      ];

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            // Return an object that supports orderBy chaining for status history query
            return {
              orderBy: jest.fn(() => {
                return Promise.resolve(statusHistory);
              }),
              // For direct await (application existence check)
              then: jest.fn((resolve) => {
                resolve([mockApplication]);
              }),
            };
          }),
          orderBy: jest.fn(() => {
            return Promise.resolve(statusHistory);
          }),
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
  });
});
