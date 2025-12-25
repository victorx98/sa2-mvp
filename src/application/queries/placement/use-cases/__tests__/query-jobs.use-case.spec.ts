/**
 * Query Jobs Use Case Unit Tests
 * 岗位查询用例单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { QueryJobsUseCase } from '../query-jobs.use-case';
import { IJobQueryRepository, JOB_QUERY_REPOSITORY } from '../../interfaces/job-query.repository.interface';
import { JobReadModel } from '../../models/job-read.model';
import { IPaginatedResult } from '@shared/types/paginated-result';

describe('QueryJobsUseCase', () => {
  let useCase: QueryJobsUseCase;
  let mockRepository: jest.Mocked<IJobQueryRepository>;

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      queryJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryJobsUseCase,
        {
          provide: JOB_QUERY_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    useCase = module.get<QueryJobsUseCase>(QueryJobsUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call repository and return paginated results', async () => {
    // Arrange
    const mockResult: IPaginatedResult<JobReadModel> = {
      data: [
        {
          id: '1',
          title: 'Software Engineer',
          companyName: 'Test Company',
          jobLocations: ['New York'],
          jobTypes: ['Full-time'],
          level: 'Mid',
          h1b: 'yes',
          usCitizenship: 'no',
          postDate: new Date('2024-01-01'),
          applicationDeadline: new Date('2024-02-01'),
          jobApplicationType: ['direct'],
          status: 'active',
          normalizedJobTitles: ['software-engineer'],
          description: 'Test description',
          requirements: null,
          responsibilities: null,
          benefits: null,
          salaryMin: '100000',
          salaryMax: '150000',
          salaryCurrency: 'USD',
          experienceYearsMin: 3,
          experienceYearsMax: 5,
          educationLevel: 'Bachelor',
          skills: ['JavaScript', 'TypeScript'],
          remoteWorkOption: 'hybrid',
          source: 'linkedin',
          sourceUrl: 'https://linkedin.com/jobs/1',
          companySize: '100-500',
          companyIndustry: 'Technology',
          metadata: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };

    mockRepository.queryJobs.mockResolvedValue(mockResult);

    const dto = {
      filter: {
        jobApplicationType: 'direct',
        status: 'active',
      },
      pagination: {
        page: 1,
        pageSize: 20,
      },
    };

    // Act
    const result = await useCase.execute(dto);

    // Assert
    expect(mockRepository.queryJobs).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResult);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Software Engineer');
  });

  it('should handle empty results', async () => {
    // Arrange
    const mockResult: IPaginatedResult<JobReadModel> = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };

    mockRepository.queryJobs.mockResolvedValue(mockResult);

    const dto = {
      filter: {
        jobApplicationType: 'direct',
      },
    };

    // Act
    const result = await useCase.execute(dto);

    // Assert
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

