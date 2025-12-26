import { Injectable, Inject } from '@nestjs/common';
import { IClassSessionQueryRepository, CLASS_SESSION_QUERY_REPOSITORY } from '../interfaces/class-session-query.repository.interface';
import { ClassSessionReadModel } from '../interfaces/class-session-query.repository.interface';

@Injectable()
export class GetClassSessionByIdUseCase {
  constructor(
    @Inject(CLASS_SESSION_QUERY_REPOSITORY)
    private readonly classSessionQueryRepository: IClassSessionQueryRepository,
  ) {}

  async execute(sessionId: string): Promise<ClassSessionReadModel> {
    return this.classSessionQueryRepository.getSessionById(sessionId);
  }
}
