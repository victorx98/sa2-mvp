import { IPaginatedResult } from '@shared/types/paginated-result';
import { ClassReadModel, ClassMemberReadModel } from '../models/class-read.model';
import { QueryClassesDto, GetClassMembersDto } from '../dto/class-query.dto';

export const CLASS_QUERY_REPOSITORY = Symbol('CLASS_QUERY_REPOSITORY');

export interface IClassQueryRepository {
  queryClasses(dto: QueryClassesDto): Promise<IPaginatedResult<ClassReadModel>>;
  getClassMentorsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]>;
  getClassStudentsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]>;
  getClassCounselorsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]>;
}
