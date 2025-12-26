import { Injectable, Inject } from '@nestjs/common';
import { RecommLetterTypeReadModel, RecommLetterTypeTreeNode } from '../models/recomm-letter-type-read.model';
import { QueryRecommLetterTypesDto } from '../dto/recomm-letter-type-query.dto';
import { IRecommLetterTypeQueryRepository, RECOMM_LETTER_TYPE_QUERY_REPOSITORY } from '../interfaces/recomm-letter-type-query.repository.interface';

@Injectable()
export class GetRecommLetterTypesUseCase {
  constructor(
    @Inject(RECOMM_LETTER_TYPE_QUERY_REPOSITORY)
    private readonly recommLetterTypeQueryRepository: IRecommLetterTypeQueryRepository,
  ) {}

  async execute(dto: QueryRecommLetterTypesDto): Promise<RecommLetterTypeReadModel[]> {
    return this.recommLetterTypeQueryRepository.findRecommLetterTypes(dto);
  }

  async getTypesTree(serviceTypeCode?: string): Promise<RecommLetterTypeTreeNode[]> {
    return this.recommLetterTypeQueryRepository.getTypesTree(serviceTypeCode);
  }
}
