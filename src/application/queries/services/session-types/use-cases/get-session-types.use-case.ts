import { Injectable, Inject } from '@nestjs/common';
import { SessionTypeReadModel } from '../models/session-type-read.model';
import { QuerySessionTypesDto } from '../dto/session-type-query.dto';
import { ISessionTypeQueryRepository, SESSION_TYPE_QUERY_REPOSITORY } from '../interfaces/session-type-query.repository.interface';

@Injectable()
export class GetSessionTypesUseCase {
  constructor(
    @Inject(SESSION_TYPE_QUERY_REPOSITORY)
    private readonly sessionTypeQueryRepository: ISessionTypeQueryRepository,
  ) {}

  async execute(dto: QuerySessionTypesDto): Promise<SessionTypeReadModel[]> {
    return this.sessionTypeQueryRepository.findSessionTypes(dto);
  }
}
