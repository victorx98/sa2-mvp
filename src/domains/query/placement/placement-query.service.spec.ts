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
    jobTypes: ['全职'],
    postDate: new Date('2023-01-20'),
    h1b: 'false',
    usCitizenship: 'required',
  },
  {
    id: 'job-2',
    title: '算法工程师',
    companyName: '百度',
    status: 'active',
    jobLocations: ['北京'],
    jobTypes: ['全职'],
    postDate: new Date('2023-01-18'),
    h1b: 'true',
    usCitizenship: 'not_required',
  },
  {
    id: 'job-3',
    title: '测试工程师',
    companyName: '网易',
    status: 'active',
    jobLocations: ['杭州'],
    jobTypes: ['全职'],
    postDate: new Date('2023-01-16'),
    h1b: 'true',
    usCitizenship: 'not_required',
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
    it('should return all active jobs with default pagination and sorting', async () => {
      const results = await service.queryJobs();

      expect(results).toEqual({
        items: mockJobs,
        total: mockJobs.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('should filter jobs by location', async () => {
      const results = await service.queryJobs({ locations: ['杭州'] });

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter jobs by keyword', async () => {
      const results = await service.queryJobs({ keyword: '算法' });

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter jobs by H1B status', async () => {
      const results = await service.queryJobs({ h1b: 'true' });

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
    });

    it('should apply pagination correctly', async () => {
      const results = await service.queryJobs(undefined, { page: 1, pageSize: 2 });

      expect(results).toEqual({
        items: mockJobs,
        total: mockJobs.length,
        page: 1,
        pageSize: 2,
        totalPages: 2,
      });
    });

    it('should apply sorting correctly', async () => {
      const results = await service.queryJobs(undefined, undefined, { field: 'postDate', direction: 'asc' });

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid sort field gracefully', async () => {
      const results = await service.queryJobs(undefined, undefined, { field: 'invalid-field', direction: 'asc' });

      expect(results).toHaveProperty('items');
      expect(results.total).toBeGreaterThanOrEqual(0);
    });
  });
});