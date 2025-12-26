import { Injectable, Inject } from '@nestjs/common';
import { IRegularMentoringQueryRepository, REGULAR_MENTORING_QUERY_REPOSITORY, RegularMentoringQueryDto } from '../interfaces/regular-mentoring-query.repository.interface';
import { RegularMentoringReadModel } from '../interfaces/regular-mentoring-query.repository.interface';

@Injectable()
export class GetMentorRegularMentoringSessionsUseCase {
  constructor(
    @Inject(REGULAR_MENTORING_QUERY_REPOSITORY)
    private readonly regularMentoringQueryRepository: IRegularMentoringQueryRepository,
  ) {}

  async execute(mentorId: string, filters?: RegularMentoringQueryDto): Promise<RegularMentoringReadModel[]> {
    return this.regularMentoringQueryRepository.getMentorSessions(mentorId, filters);
  }
}
