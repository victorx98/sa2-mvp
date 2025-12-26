/**
 * Mentor List Use Case
 * 导师列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMentorQueryRepository, MENTOR_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class MentorListUseCase {
  constructor(
    @Inject(MENTOR_QUERY_REPOSITORY)
    private readonly mentorQueryRepository: IMentorQueryRepository,
  ) {}

  async listMentors(params: any): Promise<IPaginatedResult<any>> {
    return this.mentorQueryRepository.listMentors(params);
  }
}

