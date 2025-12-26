/**
 * Query Job Applications Use Case Unit Tests
 * 投递申请查询用例单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { QueryJobApplicationsUseCase } from '../query-job-applications.use-case';
import { IJobApplicationQueryRepository, JOB_APPLICATION_QUERY_REPOSITORY } from '../../interfaces/job-application-query.repository.interface';
import { JobApplicationReadModel } from '../../models/job-application-read.model';
import { IPaginatedResult } from '@shared/types/paginated-result';

describe('QueryJobApplicationsUseCase', () => {
  let useCase: QueryJobApplicationsUseCase;
  let mockRepository: jest.Mocked<IJobApplicationQueryRepository>;

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      queryJobApplications: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryJobApplicationsUseCase,
        {
          provide: JOB_APPLICATION_QUERY_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    useCase = module.get<QueryJobApplicationsUseCase>(QueryJobApplicationsUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call repository and return paginated results', async () => {
    // Arrange
    const mockResult: IPaginatedResult<JobApplicationReadModel> = {
      data: [
        {
          id: '1',
          studentId: 'student-1',
          recommendedJobId: 'job-1',
          applicationType: 'direct',
          coverLetter: 'Test cover letter',
          customAnswers: null,
          status: 'submitted',
          result: null,
          resultReason: null,
          submittedAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          notes: null,
          assignedMentorId: null,
          recommendedBy: null,
          recommendedAt: null,
          objectId: null,
          jobId: 'job-1',
          jobLink: 'https://example.com/job',
          jobType: 'Full-time',
          jobTitle: 'Software Engineer',
          companyName: 'Test Company',
          location: 'New York',
          jobCategories: ['Engineering'],
          normalJobTitle: 'software-engineer',
          level: 'Mid',
          student: {
            id: 'student-1',
            name_cn: '张三',
            name_en: 'Zhang San',
          },
          mentor: null,
          counselor: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };

    mockRepository.queryJobApplications.mockResolvedValue(mockResult);

    const dto = {
      filter: {
        status: 'submitted',
        studentId: 'student-1',
      },
      pagination: {
        page: 1,
        pageSize: 20,
      },
    };

    // Act
    const result = await useCase.execute(dto);

    // Assert
    expect(mockRepository.queryJobApplications).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResult);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe('submitted');
  });

  it('should handle empty results', async () => {
    // Arrange
    const mockResult: IPaginatedResult<JobApplicationReadModel> = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };

    mockRepository.queryJobApplications.mockResolvedValue(mockResult);

    const dto = {
      filter: {},
    };

    // Act
    const result = await useCase.execute(dto);

    // Assert
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

