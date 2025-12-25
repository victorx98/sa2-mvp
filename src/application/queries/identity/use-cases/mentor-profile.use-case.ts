/**
 * Mentor Profile Use Case
 * 导师档案查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IMentorQueryRepository, MENTOR_QUERY_REPOSITORY } from '../interfaces/identity-query.repository.interface';

@Injectable()
export class MentorProfileUseCase {
  constructor(
    @Inject(MENTOR_QUERY_REPOSITORY)
    private readonly mentorQueryRepository: IMentorQueryRepository,
  ) {}

  async getMentorProfile(mentorId: string): Promise<any> {
    return this.mentorQueryRepository.getMentorProfile(mentorId);
  }
}

