import { IPaginatedResult } from '@shared/types/paginated-result';
import { ClassSessionReadModel } from '../models/class-session-read.model';
import { QueryClassSessionsDto } from '../dto/class-session-query.dto';

export const CLASS_SESSION_QUERY_REPOSITORY = Symbol('CLASS_SESSION_QUERY_REPOSITORY');

export interface IClassSessionQueryRepository {
  queryClassSessions(dto: QueryClassSessionsDto): Promise<IPaginatedResult<ClassSessionReadModel>>;
}
