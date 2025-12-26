import { SessionTypeReadModel } from '../models/session-type-read.model';

export const SESSION_TYPE_QUERY_REPOSITORY = Symbol('SESSION_TYPE_QUERY_REPOSITORY');
export { SessionTypeReadModel };

export interface ISessionTypeQueryRepository {
  findSessionTypes(dto: QuerySessionTypesDto): Promise<SessionTypeReadModel[]>;
}

export interface QuerySessionTypesDto {
  serviceTypeCode?: string;
}
