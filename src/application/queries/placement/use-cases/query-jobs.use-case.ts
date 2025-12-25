/**
 * Query Jobs Use Case
 * 岗位查询用例
 * 
 * Application layer use case - orchestrates query logic without DB dependency
 * Depends on repository interface only
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobQueryRepository, JOB_QUERY_REPOSITORY } from '../interfaces/job-query.repository.interface';
import { JobReadModel } from '../models/job-read.model';
import { QueryJobsDto } from '../dto/query-jobs.dto';

@Injectable()
export class QueryJobsUseCase {
  constructor(
    @Inject(JOB_QUERY_REPOSITORY)
    private readonly jobQueryRepository: IJobQueryRepository,
  ) {}

  /**
   * Execute job query
   * 
   * @param dto - Query input
   * @returns Paginated job results with unified structure
   */
  async execute(dto: QueryJobsDto): Promise<IPaginatedResult<JobReadModel>> {
    // Use case only handles orchestration/rules/permissions
    // All SQL and data mapping is delegated to repository
    return this.jobQueryRepository.queryJobs(dto);
  }
}

