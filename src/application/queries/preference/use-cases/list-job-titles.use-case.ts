/**
 * List Job Titles Use Case
 * 岗位名称列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IJobTitleQueryRepository, JOB_TITLE_QUERY_REPOSITORY } from '../interfaces/job-title-query.repository.interface';
import { JobTitleReadModel } from '../models/job-title-read.model';
import { ListJobTitlesDto } from '../dto/preference-query.dto';

@Injectable()
export class ListJobTitlesUseCase {
  constructor(
    @Inject(JOB_TITLE_QUERY_REPOSITORY)
    private readonly jobTitleQueryRepository: IJobTitleQueryRepository,
  ) {}

  async execute(dto: ListJobTitlesDto): Promise<IPaginatedResult<JobTitleReadModel>> {
    return this.jobTitleQueryRepository.listJobTitles(dto);
  }

  async findById(id: string): Promise<JobTitleReadModel | null> {
    return this.jobTitleQueryRepository.findById(id);
  }
}

