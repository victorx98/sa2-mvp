/**
 * Query Job Applications Use Case
 * 投递申请查询用例
 * 
 * Application layer use case - orchestrates query logic without DB dependency
 * Depends on repository interface only
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobApplicationQueryRepository, JOB_APPLICATION_QUERY_REPOSITORY } from '../interfaces/job-application-query.repository.interface';
import { JobApplicationReadModel } from '../models/job-application-read.model';
import { QueryJobApplicationsDto } from '../dto/query-job-applications.dto';

@Injectable()
export class QueryJobApplicationsUseCase {
  constructor(
    @Inject(JOB_APPLICATION_QUERY_REPOSITORY)
    private readonly jobApplicationQueryRepository: IJobApplicationQueryRepository,
  ) {}

  /**
   * Execute job application query
   * 
   * @param dto - Query input
   * @returns Paginated job application results with unified structure
   */
  async execute(dto: QueryJobApplicationsDto): Promise<IPaginatedResult<JobApplicationReadModel>> {
    // Use case only handles orchestration/rules/permissions
    // All SQL and data mapping is delegated to repository
    return this.jobApplicationQueryRepository.queryJobApplications(dto);
  }
}

