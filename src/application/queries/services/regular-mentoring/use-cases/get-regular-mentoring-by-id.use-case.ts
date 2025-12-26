import { Injectable, Inject } from '@nestjs/common';
import { IRegularMentoringQueryRepository, REGULAR_MENTORING_QUERY_REPOSITORY } from '../interfaces/regular-mentoring-query.repository.interface';
import { RegularMentoringReadModel } from '../interfaces/regular-mentoring-query.repository.interface';

@Injectable()
export class GetRegularMentoringByIdUseCase {
  constructor(
    @Inject(REGULAR_MENTORING_QUERY_REPOSITORY)
    private readonly regularMentoringQueryRepository: IRegularMentoringQueryRepository,
  ) {}

  async execute(sessionId: string): Promise<RegularMentoringReadModel> {
    return this.regularMentoringQueryRepository.getSessionById(sessionId);
  }
}
