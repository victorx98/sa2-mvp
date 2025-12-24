import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { JobPositionService } from "../job-position.service";
import { ICreateJobPositionDto } from "@api/dto/request/placement/placement.index";
import { randomUUID } from "crypto";

/**
 * DTO for marking a job position as expired [标记岗位为过期的DTO]
 */
interface IMarkJobExpiredDto {
  jobId: string;
  expiredBy?: string;
  expiredByType?: string;
  reason?: string;
}

/**
 * Unit Tests for JobPositionService
 * [JobPositionService 单元测试]
 *
 * Test Strategy:
 * - This is a UNIT test for the domain service layer
 * - Test level: Service methods in isolation with mocked dependencies
 * - Mock external dependencies: Database
 * - Focus: Business logic validation (job creation, search, status changes, etc.)
 * - Does NOT test: Database operations, event publishing, external service calls
 */
describe("JobPositionService Unit Tests [岗位服务单元测试]", () => {
  let moduleRef: TestingModule;
  let jobPositionService: JobPositionService;
  let mockDb: any;
  const testJobId = randomUUID(); // Job position ID is now UUID [岗位ID现在是UUID]
  const testUserId = randomUUID();

  // Helper function to create properly mocked database operation
  // [创建模拟数据库操作的辅助函数]
  const _createMockDbOperation = (overrides: any = {}) => {
    const {
      selectReturnValue = [],
      insertReturnValue = [],
      updateReturnValue = [],
    } = overrides;

    return {
      select: jest.fn(() => {
        // Create a mock query builder that returns a promise resolving to selectReturnValue
        // This handles the destructuring like const [job] = await this.db.select().from().where()
        return {
          from: jest.fn(() => {
            return {
              where: jest.fn(() => {
                // Return a promise that resolves to selectReturnValue
                // This allows it to be awaited and destructured
                return Promise.resolve(selectReturnValue);
              }),
              limit: jest.fn(() => {
                return {
                  offset: jest.fn(() => {
                    return Promise.resolve(selectReturnValue);
                  }),
                };
              }),
              orderBy: jest.fn(() => {
                return Promise.resolve(selectReturnValue);
              }),
              returning: jest.fn(() => {
                return Promise.resolve(selectReturnValue);
              }),
            };
          }),
        };
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue(insertReturnValue),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue(updateReturnValue),
          })),
        })),
      })),
      delete: jest.fn(),
      transaction: jest.fn(async (callback) => {
        const mockTx = _createMockDbOperation(overrides);
        return await callback(mockTx);
      }),
    };
  };

  beforeEach(async () => {
    // Create a simple mock that directly returns a promise resolving to an array
    // This simulates how Drizzle ORM's query builder works when awaited
    mockDb = {
      select: jest.fn(() => {
        return {
          from: jest.fn(() => {
            return {
              where: jest.fn(() => {
                // Return a promise that resolves to an empty array
                // This allows destructuring like const [job] = await ...
                return Promise.resolve([]);
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
        JobPositionService,
      ],
    }).compile();

    jobPositionService = moduleRef.get<JobPositionService>(JobPositionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createJobPosition() [创建岗位]", () => {
    it("should create job position successfully [应该成功创建岗位]", async () => {
      // Arrange [准备]
      const dto: ICreateJobPositionDto = {
        jobTitle: "Software Engineer", // Changed from 'title' to 'jobTitle' [从'title'改为'jobTitle']
        companyName: "Test Company",
        source: "web",
        // createdBy is passed as separate parameter [createdBy作为单独参数传递]
      };

      const createdJob = {
        id: testJobId,
        jobTitle: dto.jobTitle, // Changed from 'title' to 'jobTitle' [从'title'改为'jobTitle']
        companyName: dto.companyName,
        source: dto.source,
        status: "active",
        viewCount: 0,
        directApplicationCount: 0,
        counselorApplicationCount: 0,
        mentorApplicationCount: 0,
        bdApplicationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([createdJob]),
        })),
      }));

      // Act [执行]
      const result = await jobPositionService.createJobPosition(dto, testUserId);

      // Assert [断言]
      expect(result.data).toEqual(createdJob);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should create job position with optional fields [应该创建带有可选字段的岗位]", async () => {
      // Arrange [准备]
      const dto: ICreateJobPositionDto = {
        jobTitle: "Software Engineer", // Changed from 'title' to 'jobTitle' [从'title'改为'jobTitle']
        companyName: "Test Company",
        source: "web",
        // createdBy is passed as separate parameter

        jobDescription: "Test description", // Changed from 'description' to 'jobDescription' [从'description'改为'jobDescription']
        experienceRequirement: { // Changed from 'requirements' to 'experienceRequirement' [从'requirements'改为'experienceRequirement']
          min_years: 3,
          max_years: 5,
        },
        jobTypes: ["Full-time"], // Use valid enum values [使用有效枚举值]
        locations: ["Beijing", "Shanghai"],
        salaryDetails: { // Changed from individual salary fields to salaryDetails object [从单独的salary字段改为salaryDetails对象]
          base_salary: {
            min: 10000,
            max: 20000,
          },
        },
        postDate: new Date(), // Changed from 'postedDate' to 'postDate' [从'postedDate'改为'postDate']
      };

      const createdJob = {
        id: testJobId,
        ...dto,
        status: "active",
        viewCount: 0,
        directApplicationCount: 0,
        counselorApplicationCount: 0,
        mentorApplicationCount: 0,
        bdApplicationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([createdJob]),
        })),
      }));

      // Act [执行]
      const result = await jobPositionService.createJobPosition(dto, testUserId);

      // Assert [断言]
      expect(result.data).toEqual(createdJob);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("findOne() [查找岗位]", () => {
    it("should find job position by ID successfully [应该成功根据ID查找岗位]", async () => {
      // Arrange [准备]
      const mockJob = {
        id: testJobId,
        jobTitle: "Software Engineer", // Changed from 'title' to 'jobTitle' [从'title'改为'jobTitle']
        companyName: "Test Company",
        status: "active",
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockJob]);
          }),
        })),
      }));

      // Act [执行]
      const result = await jobPositionService.findOne({ id: testJobId });

      // Assert [断言]
      expect(result).toEqual(mockJob);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should throw NotFoundException if job not found [如果岗位未找到应该抛出NotFoundException]", async () => {
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
        jobPositionService.findOne({ id: testJobId }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should find job position by other parameters [应该通过其他参数查找岗位]", async () => {
      // Arrange [准备]
      const mockJob = {
        id: testJobId,
        jobTitle: "Software Engineer", // Changed from 'title' to 'jobTitle' [从'title'改为'jobTitle']
        companyName: "Test Company",
        status: "active",
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockJob]);
          }),
        })),
      }));

      // Act [执行]
      const result = await jobPositionService.findOne({
        title: "Software Engineer", // Test with title parameter [测试title参数]
        companyName: "Test Company",
      });

      // Assert [断言]
      expect(result).toEqual(mockJob);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("search() [搜索岗位]", () => {
    it("should search job positions with status filter [应该使用状态筛选搜索岗位]", async () => {
      // Arrange [准备]
      const filter = { status: "active" as const };
      const pagination = { page: 1, pageSize: 10 };

      const mockJobs = [
        {
          id: testJobId,
          title: "Software Engineer",
          companyName: "Test Company",
          status: "active",
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
              limit: jest.fn(() => ({
                offset: jest.fn().mockResolvedValue(mockJobs),
              })),
            })),
          })),
        };
      });

      // Act [执行]
      const result = await jobPositionService.search(filter, pagination);

      // Assert [断言]
      expect(result.items).toEqual(mockJobs);
      expect(result.total).toBe(1);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(10);
    });

    it("should search job positions with company name filter [应该使用公司名称筛选搜索岗位]", async () => {
      // Arrange [准备]
      const filter = { companyName: "Test" };
      const pagination = { page: 1, pageSize: 10 };

      const mockJobs = [
        {
          id: testJobId,
          title: "Software Engineer",
          companyName: "Test Company",
          status: "active",
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
              limit: jest.fn(() => ({
                offset: jest.fn().mockResolvedValue(mockJobs),
              })),
            })),
          })),
        };
      });

      // Act [执行]
      const result = await jobPositionService.search(filter, pagination);

      // Assert [断言]
      expect(result.items).toEqual(mockJobs);
      expect(result.total).toBe(1);
    });

    it("should return empty array if no jobs found [如果没有找到岗位应该返回空数组]", async () => {
      // Arrange [准备]
      const filter = { status: "active" as const };
      const pagination = { page: 1, pageSize: 10 };

      const mockJobs: any[] = [];
      const mockCountResult = [{ count: 0 }];

      mockDb.select = jest.fn((columns?: any) => {
        if (columns && columns.count) {
          return {
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn().mockResolvedValue(mockCountResult),
              })),
            })),
          };
        }
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: jest.fn(() => ({
                offset: jest.fn().mockResolvedValue(mockJobs),
              })),
            })),
          })),
        };
      });

      // Act [执行]
      const result = await jobPositionService.search(filter, pagination);

      // Assert [断言]
      expect(result.items).toEqual(mockJobs);
      expect(result.total).toBe(0);
    });

    it("should search job positions with sorting [应该使用排序搜索岗位]", async () => {
      // Arrange [准备]
      const filter = { status: "active" as const };
      const pagination = { page: 1, pageSize: 10 };
      const sort = { field: "title", direction: "asc" as const };

      const mockJobs = [
        {
          id: testJobId,
          title: "Software Engineer",
          companyName: "Test Company",
          status: "active",
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
        const mockQuery = {
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              offset: jest.fn().mockResolvedValue(mockJobs),
            })),
          })),
          limit: jest.fn(() => ({
            offset: jest.fn().mockResolvedValue(mockJobs),
          })),
        };
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => mockQuery),
          })),
        };
      });

      // Act [执行]
      const result = await jobPositionService.search(filter, pagination, sort);

      // Assert [断言]
      expect(result.items).toEqual(mockJobs);
      expect(result.total).toBe(1);
    });
  });

  describe("markJobExpired() [标记岗位过期]", () => {
    it("should mark job position as expired successfully [应该成功标记岗位过期]", async () => {
      // Arrange [准备]
      const dto: IMarkJobExpiredDto = {
        jobId: testJobId,
        expiredBy: testUserId,
        expiredByType: "bd",
        reason: "Expired automatically",
      };

      const mockJob = {
        id: testJobId,
        jobTitle: "Software Engineer", // Changed from 'title' to 'jobTitle' [从'title'改为'jobTitle']
        companyName: "Test Company",
        status: "active",
      };

      const updatedJob = {
        ...mockJob,
        status: "expired",
        updatedAt: new Date(),
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockJob]);
          }),
        })),
      }));

      mockDb.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([updatedJob]),
          })),
        })),
      }));

      // Act [执行]
      const result = await jobPositionService.markJobExpired(dto);

      // Assert [断言]
      expect(result.data).toEqual(updatedJob);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw error if job is already expired [如果岗位已经过期应该抛出错误]", async () => {
      // Arrange [准备]
      const dto: IMarkJobExpiredDto = {
        jobId: testJobId,
        expiredBy: testUserId,
        expiredByType: "bd",
        reason: "Expired automatically",
      };

      const mockJob = {
        id: testJobId,
        title: "Software Engineer",
        companyName: "Test Company",
        status: "expired",
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([mockJob]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(jobPositionService.markJobExpired(dto)).rejects.toThrow(
        /already expired/,
      );
    });

    it("should throw NotFoundException if job not found [如果岗位未找到应该抛出NotFoundException]", async () => {
      // Arrange [准备]
      const dto: IMarkJobExpiredDto = {
        jobId: testJobId,
        expiredBy: testUserId,
        expiredByType: "bd",
        reason: "Expired automatically",
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            return Promise.resolve([]);
          }),
        })),
      }));

      // Act & Assert [执行和断言]
      await expect(jobPositionService.markJobExpired(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
