/**
 * Class Query Repository Interface
 * 班级查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { QueryClassesDto, GetClassMembersDto } from '../dto/class-query.dto';
import { ClassReadModel, ClassMemberReadModel } from '../models/class-read.model';

export const CLASS_QUERY_REPOSITORY = Symbol('CLASS_QUERY_REPOSITORY');

export interface IClassQueryRepository {
  queryClasses(dto: QueryClassesDto): Promise<IPaginatedResult<ClassReadModel>>;
  getClassMentorsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]>;
  getClassStudentsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]>;
  getClassCounselorsWithNames(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]>;
}
