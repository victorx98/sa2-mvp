/**
 * Placement Query Integration Tests [岗位查询集成测试]
 * Tests the complete flow of the placement query API endpoint [测试岗位查询API端点的完整流程]
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PlacementQueryController } from '@api/controllers/placement/placement-query.controller';
import { PlacementQueryService } from '@domains/query/placement/placement-query.service';
import { IJobQueryFilter } from '@domains/query/placement/dto/placement-query.dto';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { ValidationPipe } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common/serializer';
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { JobQueryDto } from '@api/dto/request/placement-query.request.dto';

// Mock the PlacementQueryService [模拟PlacementQueryService]
const mockPlacementQueryService = {
  queryJobs: jest.fn().mockResolvedValue({
    items: [
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
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  }),
};

// Mock the guards [模拟守卫]
const mockJwtAuthGuard = {
  canActivate: jest.fn().mockImplementation(() => true),
};

const mockRolesGuard = {
  canActivate: jest.fn().mockImplementation(() => true),
};

describe('Placement Query API Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlacementQueryController],
      providers: [
        {
          provide: PlacementQueryService,
          useValue: mockPlacementQueryService,
        },
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: {
              enableImplicitConversion: true,
            },
          }),
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: ClassSerializerInterceptor,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/query/placement/jobs', () => {
    it('should return paginated job results with default parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          items: expect.any(Array),
          total: expect.any(Number),
          page: expect.any(Number),
          pageSize: expect.any(Number),
          totalPages: expect.any(Number),
        },
        message: 'Job query completed successfully',
      });

      expect(mockPlacementQueryService.queryJobs).toHaveBeenCalledWith(
        expect.objectContaining({ jobApplicationType: 'direct', status: 'active' }),
        { page: 1, pageSize: 20 },
        { field: 'postDate', direction: 'desc' },
      );
    });

    it('should return job results with custom pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct&page=2&pageSize=10')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(mockPlacementQueryService.queryJobs).toHaveBeenCalledWith(
        expect.objectContaining({ jobApplicationType: 'direct', status: 'active' }),
        { page: 2, pageSize: 10 },
        { field: 'postDate', direction: 'desc' },
      );
    });

    it('should return job results with sorting', async () => {
      const response = await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct&sortField=title&sortDirection=asc')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(mockPlacementQueryService.queryJobs).toHaveBeenCalledWith(
        expect.objectContaining({ jobApplicationType: 'direct', status: 'active' }),
        { page: 1, pageSize: 20 },
        { field: 'title', direction: 'asc' },
      );
    });

    it('should filter jobs by location', async () => {
      await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct&location=杭州')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(mockPlacementQueryService.queryJobs).toHaveBeenCalledWith(
        expect.objectContaining({ jobApplicationType: 'direct', location: '杭州', status: 'active' }),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should filter jobs by keyword', async () => {
      const response = await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct&keyword=算法')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(mockPlacementQueryService.queryJobs).toHaveBeenCalledWith(
        expect.objectContaining({ jobApplicationType: 'direct', keyword: '算法', status: 'active' }),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should filter jobs by multiple criteria', async () => {
      await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct&location=北京&h1b=yes&keyword=算法')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(mockPlacementQueryService.queryJobs).toHaveBeenCalledWith(
        expect.objectContaining({ 
          jobApplicationType: 'direct',
          location: '北京', // Single value [单值]
          h1b: 'yes', // Use actual database value [使用数据库实际值]
          keyword: '算法',
          status: 'active' 
        }),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should return 200 even without authorization header due to mocked guard', async () => {
      await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct')
        .expect(200);
    });

    it('should validate query parameters', async () => {
      await request(app.getHttpServer())
        .get('/query/placement/jobs?jobApplicationType=direct&page=0&pageSize=0')
        .set('Authorization', 'Bearer mock-token')
        .expect(400);
    });

    it('should return 400 when jobApplicationType is missing', async () => {
      await request(app.getHttpServer())
        .get('/query/placement/jobs')
        .set('Authorization', 'Bearer mock-token')
        .expect(400);
    });
  });
});