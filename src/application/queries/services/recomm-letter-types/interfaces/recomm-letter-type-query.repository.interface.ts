import { RecommLetterTypeReadModel, RecommLetterTypeTreeNode } from '../models/recomm-letter-type-read.model';
import { QueryRecommLetterTypesDto } from '../dto/recomm-letter-type-query.dto';

export const RECOMM_LETTER_TYPE_QUERY_REPOSITORY = Symbol('RECOMM_LETTER_TYPE_QUERY_REPOSITORY');
export { RecommLetterTypeReadModel, RecommLetterTypeTreeNode };

export interface IRecommLetterTypeQueryRepository {
  findRecommLetterTypes(dto: QueryRecommLetterTypesDto): Promise<RecommLetterTypeReadModel[]>;
  getTypesTree(serviceTypeCode?: string): Promise<RecommLetterTypeTreeNode[]>;
}
