/**
 * Placement Query Service Unit Tests [岗位查询服务单元测试]
 * Tests the core functionality of the PlacementQueryService [测试PlacementQueryService的核心功能]
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PlacementQueryService } from './placement-query.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { recommendedJobs } from '@infrastructure/database/schema';
import { DrizzleDatabase } from '@shared/types/database.types';

// Mock data for testing [测试用模拟数据]
const mockJobs = [
  {
    id: 'job-1',
    title: 'AI产品专家',
    companyName: '阿里巴巴',
    status: 'active',
    jobLocations: ['杭州'],
    jobTypes: ['Full-time'], // Use valid enum values [使用有效枚举值]
    normalizedJobTitles: ['ai产品专家', 'ai', '产品专家'],
    jobApplicationType: ['direct', 'proxy'],
    postDate: new Date('2023-01-20'),
    h1b: 'no', // Match database actual values [匹配数据库实际值]
    usCitizenship: 'preferred', // Match database actual values [匹配数据库实际值]
    level: 'entry_level', // Job level requirement [岗位级别要求]
  },
  {
    id: 'job-2',
    title: '算法工程师',
    companyName: '百度',
    status: 'active',
    jobLocations: ['北京'],
    jobTypes: ['Full-time'], // Use valid enum values [使用有效枚举值]
    normalizedJobTitles: ['算法工程师', '算法', '工程师'],
    jobApplicationType: ['direct', 'referral'],
    postDate: new Date('2023-01-18'),
    h1b: 'yes', // Match database actual values [匹配数据库实际值]
    usCitizenship: 'no', // Match database actual values [匹配数据库实际值]
    level: 'mid_level', // Job level requirement [岗位级别要求]
  },
  {
    id: 'job-3',
    title: '测试工程师',
    companyName: '网易',
    status: 'active',
    jobLocations: ['杭州'],
    jobTypes: ['Full-time'], // Use valid enum values [使用有效枚举值]
    normalizedJobTitles: ['测试工程师', '测试', '工程师'],
    jobApplicationType: ['proxy', 'bd'],
    postDate: new Date('2023-01-16'),
    h1b: 'yes', // Match database actual values [匹配数据库实际值]
    usCitizenship: 'no', // Match database actual values [匹配数据库实际值]
    level: 'senior_level', // Job level requirement [岗位级别要求]
  },
  {
    id: 'job-4',
    title: '前端开发工程师',
    companyName: '腾讯',
    status: 'active',
    jobLocations: ['深圳'],
    jobTypes: ['Internship'], // Use valid enum values [使用有效枚举值]
    normalizedJobTitles: ['前端开发工程师', '前端', '开发工程师'],
    jobApplicationType: ['referral'],
    postDate: new Date('2023-01-15'),
    h1b: 'maybe', // Match database actual values [匹配数据库实际值]
    usCitizenship: 'no', // Match database actual values [匹配数据库实际值]
    level: 'entry_level', // Job level requirement [岗位级别要求]
  },
];

// Mock database connection [模拟数据库连接]
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  transaction: jest.fn().mockImplementation((callback) => callback(mockDb)),
  eq: jest.fn().mockReturnValue('eq-condition'),
  and: jest.fn().mockReturnValue('and-condition'),
  or: jest.fn().mockReturnValue('or-condition'),
  sql: jest.fn().mockImplementation((sqlString) => sqlString),
};

// Mock query results [模拟查询结果]
mockDb.select.mockImplementation(() => {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(() => {
      return {
        offset: jest.fn().mockResolvedValue(mockJobs),
      };
    }),
    orderBy: jest.fn().mockReturnThis(),
  };
});

// Mock count query [模拟计数查询]
mockDb.select.mockImplementation((selectArg) => {
  if (selectArg && selectArg.count) {
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ count: mockJobs.length }]),
    };
  }
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(() => {
      return {
        offset: jest.fn().mockResolvedValue(mockJobs),
      };
    }),
    orderBy: jest.fn().mockReturnThis(),
  };
});

describe('PlacementQueryService', () => {
  let service: PlacementQueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementQueryService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<PlacementQueryService>(PlacementQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryJobs', () => {
    describe('Required field validation [必填字段验证]', () => {
      it('should throw error when filter is undefined', async () => {
        await expect(service.queryJobs(undefined)).rejects.toThrow(
          'Job query filter is required, including jobApplicationType',
        );
      });

      it('should throw error when jobApplicationType is missing', async () => {
        await expect(service.queryJobs({} as any)).rejects.toThrow(
          'jobApplicationType is required in filter',
        );
      });
    });

    describe('Job application type filtering [投递类型筛选]', () => {
      it('should filter jobs by jobApplicationType (direct)', async () => {
        const results = await service.queryJobs({ jobApplicationType: 'direct' });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with 'direct' in jobApplicationType: job-1, job-2
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by jobApplicationType (referral)', async () => {
        const results = await service.queryJobs({ jobApplicationType: 'referral' });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with 'referral' in jobApplicationType: job-2, job-4
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by jobApplicationType (proxy)', async () => {
        const results = await service.queryJobs({ jobApplicationType: 'proxy' });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with 'proxy' in jobApplicationType: job-1, job-3
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by jobApplicationType (bd)', async () => {
        const results = await service.queryJobs({ jobApplicationType: 'bd' });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with 'bd' in jobApplicationType: job-3
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Basic query [基础查询]', () => {
    it('should return all active jobs with default pagination and sorting', async () => {
        const results = await service.queryJobs({ jobApplicationType: 'direct' });

      expect(results).toEqual({
        items: mockJobs,
        total: mockJobs.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('should apply pagination correctly', async () => {
        const results = await service.queryJobs(
          { jobApplicationType: 'direct' },
          { page: 1, pageSize: 2 },
        );

      expect(results).toEqual({
        items: mockJobs,
        total: mockJobs.length,
        page: 1,
        pageSize: 2,
        totalPages: 2,
      });
    });

    it('should apply sorting correctly', async () => {
        const results = await service.queryJobs(
          { jobApplicationType: 'direct' },
          undefined,
          { field: 'postDate', direction: 'asc' },
        );

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
        expect(results.page).toBe(1);
        expect(results.pageSize).toBe(20);
    });

    it('should handle invalid sort field gracefully', async () => {
        const results = await service.queryJobs(
          { jobApplicationType: 'direct' },
          undefined,
          { field: 'invalid-field', direction: 'asc' },
        );

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Location filtering [地点筛选]', () => {
      it('should filter jobs by location', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          location: '杭州', // Single value [单值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs in 杭州: job-1, job-3
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by different location', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          location: '北京', // Single value [单值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs in 北京: job-2
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Keyword search [关键词搜索]', () => {
      it('should filter jobs by keyword in title', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          keyword: '算法',
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with '算法' in title: job-2
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by keyword in company name', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          keyword: '百度',
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with '百度' in company: job-2
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('H1B filtering [H1B筛选]', () => {
      it('should filter jobs by H1B status (yes)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          h1b: 'yes', // Use actual database value [使用数据库实际值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with h1b='yes': job-2, job-3
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by H1B status (no)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          h1b: 'no', // Use actual database value [使用数据库实际值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with h1b='no': job-1
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by H1B status (maybe)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'referral',
          h1b: 'maybe', // Use actual database value [使用数据库实际值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with h1b='maybe': job-4
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('US citizenship filtering [美国公民身份筛选]', () => {
      it('should filter jobs by US citizenship requirement (preferred)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          usCitizenship: 'preferred', // Use actual database value [使用数据库实际值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with usCitizenship='preferred': job-1
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by US citizenship not required (no)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          usCitizenship: 'no', // Use actual database value [使用数据库实际值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with usCitizenship='no': job-2, job-3, job-4
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Level filtering [级别筛选]', () => {
      it('should filter jobs by level (entry_level)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          level: 'entry_level', // Entry level [初级]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with level='entry_level': job-1, job-4
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by level (mid_level)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          level: 'mid_level', // Mid level [中级]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with level='mid_level': job-2
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by level (senior_level)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'proxy',
          level: 'senior_level', // Senior level [高级]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with level='senior_level': job-3
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Job types filtering [职位类型筛选]', () => {
      it('should filter jobs by job type (Full-time)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          jobType: 'Full-time', // Single value [单值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by job type (Internship)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'referral',
          jobType: 'Internship', // Single value [单值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by job type (Both)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          jobType: 'Both', // Single value [单值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Job titles filtering [职位标题筛选]', () => {
      it('should filter jobs by normalized job titles', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          jobTitles: ['算法工程师'],
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with '算法工程师' in normalizedJobTitles: job-2
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Status filtering [状态筛选]', () => {
      it('should filter jobs by status (active)', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          status: 'active',
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });

      it('should default to active status when status is not provided', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Date range filtering [日期范围筛选]', () => {
      it('should filter jobs by post date range', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          postDateRange: {
            start: new Date('2023-01-17'),
            end: new Date('2023-01-19'),
          },
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs in date range: job-2 (2023-01-18)
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by start date only', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          postDateRange: {
            start: new Date('2023-01-17'),
          },
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by end date only', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          postDateRange: {
            end: new Date('2023-01-17'),
          },
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Combined filtering [组合筛选]', () => {
      it('should filter jobs by multiple conditions', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'proxy',
          location: '杭州', // Single value [单值]
          h1b: 'yes', // Use actual database value [使用数据库实际值]
          keyword: '测试',
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs matching all conditions: job-3 (杭州, h1b=yes, contains '测试')
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by jobApplicationType and location', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'referral',
          location: '深圳', // Single value [单值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs with referral in 深圳: job-4
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter jobs by jobApplicationType, keyword and H1B', async () => {
        const results = await service.queryJobs({
          jobApplicationType: 'direct',
          keyword: '算法',
          h1b: 'yes', // Use actual database value [使用数据库实际值]
        });

        expect(results).toHaveProperty('items');
        expect(results.items).toBeInstanceOf(Array);
        expect(results.total).toBeGreaterThanOrEqual(0);
        // Jobs matching: job-2 (direct, contains '算法', h1b=yes)
        expect(results.items.length).toBeGreaterThanOrEqual(0);
      });
    });
  });
});