import { Injectable } from '@nestjs/common';
import { RecommLetterTypesService, RecommLetterTypeTreeNode } from '@domains/services/recomm-letter-types/services/recomm-letter-types.service';

/**
 * Get Recommendation Letter Types Query (Application Layer)
 * 
 * Handles fetching recommendation letter types as tree structure
 */
@Injectable()
export class GetRecommLetterTypesQuery {
  constructor(
    private readonly recommLetterTypesService: RecommLetterTypesService,
  ) {}

  async execute(serviceTypeCode?: string): Promise<RecommLetterTypeTreeNode[]> {
    return this.recommLetterTypesService.getTypesTree(serviceTypeCode);
  }
}

