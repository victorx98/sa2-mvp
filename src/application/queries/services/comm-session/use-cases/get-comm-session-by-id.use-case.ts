import { Injectable, Inject } from '@nestjs/common';
import { ICommSessionQueryRepository, COMM_SESSION_QUERY_REPOSITORY } from '../interfaces/comm-session-query.repository.interface';
import { CommSessionReadModel } from '../interfaces/comm-session-query.repository.interface';

@Injectable()
export class GetCommSessionByIdUseCase {
  constructor(
    @Inject(COMM_SESSION_QUERY_REPOSITORY)
    private readonly commSessionQueryRepository: ICommSessionQueryRepository,
  ) {}

  async execute(sessionId: string): Promise<CommSessionReadModel> {
    return this.commSessionQueryRepository.getSessionById(sessionId);
  }
}
