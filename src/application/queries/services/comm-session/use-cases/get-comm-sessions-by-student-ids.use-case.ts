import { Injectable, Inject } from '@nestjs/common';
import { ICommSessionQueryRepository, COMM_SESSION_QUERY_REPOSITORY, CommSessionQueryDto } from '../interfaces/comm-session-query.repository.interface';
import { CommSessionReadModel } from '../interfaces/comm-session-query.repository.interface';

@Injectable()
export class GetCommSessionsByStudentIdsUseCase {
  constructor(
    @Inject(COMM_SESSION_QUERY_REPOSITORY)
    private readonly commSessionQueryRepository: ICommSessionQueryRepository,
  ) {}

  async execute(studentIds: string[], filters?: CommSessionQueryDto): Promise<CommSessionReadModel[]> {
    return this.commSessionQueryRepository.getSessionsByStudentIds(studentIds, filters);
  }
}
