import { Injectable, Inject } from '@nestjs/common';
import { RecommLetterTypesService, RecommLetterTypeTreeNode } from '@domains/services/recomm-letter-types/services/recomm-letter-types.service';
import { ServiceBalanceQuery } from '@application/queries/contract/service-balance.query';
import { IRecommLettersRepository, RECOMM_LETTERS_REPOSITORY } from '@domains/services/recomm-letters/repositories/recomm-letters.repository.interface';
import type { RecommLetterTypeEntity } from '@domains/services/recomm-letter-types/entities/recomm-letter-type.entity';

/**
 * Create Recommendation Letter Type DTO
 */
export interface CreateRecommLetterTypeDto {
  typeCode: string;
  typeName: string;
  serviceTypeCode: string;
  parentId?: string | null;
}

/**
 * Recommendation Letter Type Service (Application Layer)
 * 
 * Handles query and command operations for recommendation letter types
 */
@Injectable()
export class RecommLetterTypeService {
  constructor(
    private readonly recommLetterTypesService: RecommLetterTypesService,
    private readonly serviceBalanceQuery: ServiceBalanceQuery,
    @Inject(RECOMM_LETTERS_REPOSITORY)
    private readonly recommLettersRepository: IRecommLettersRepository,
  ) {}

  /**
   * Create new recommendation letter type
   */
  async create(dto: CreateRecommLetterTypeDto): Promise<RecommLetterTypeEntity> {
    return this.recommLetterTypesService.createType({
      typeCode: dto.typeCode,
      typeName: dto.typeName,
      serviceTypeCode: dto.serviceTypeCode,
      parentId: dto.parentId,
    });
  }

  /**
   * Delete recommendation letter type
   */
  async delete(id: string): Promise<void> {
    return this.recommLetterTypesService.deleteType(id);
  }

  /**
   * Get available recommendation letter types for student with statistics
   * Filters types based on contract balance and uploaded count
   */
  async getAvailableTypes(studentId: string): Promise<{
    data: RecommLetterTypeTreeNode[];
    summary: {
      online: { total: number; available: number };
      paper: { total: number; available: number };
    };
  }> {
    // Step 1: Get student service balance
    const balances = await this.serviceBalanceQuery.getServiceBalance(studentId);
    
    // Step 2: Filter only letter types (OnlineLetter, PaperLetter)
    const letterBalances = balances.filter(b => 
      b.serviceType === 'OnlineLetter' || b.serviceType === 'PaperLetter'
    );
    
    // Step 3: Get uploaded count grouped by service type
    const uploadedCounts = await this.recommLettersRepository.countByStudentGroupByType(studentId);
    
    // Step 4: Calculate statistics for each type
    const onlineBalance = letterBalances.find(b => b.serviceType === 'OnlineLetter');
    const paperBalance = letterBalances.find(b => b.serviceType === 'PaperLetter');
    
    const onlineUploaded = uploadedCounts['OnlineLetter'] || 0;
    const paperUploaded = uploadedCounts['PaperLetter'] || 0;
    
    const onlineTotal = onlineBalance?.totalQuantity || 0;
    const paperTotal = paperBalance?.totalQuantity || 0;
    
    const onlineAvailable = Math.max(0, onlineTotal - onlineUploaded);
    const paperAvailable = Math.max(0, paperTotal - paperUploaded);
    
    // Step 5: Calculate available service types (for filtering tree)
    const availableServiceTypes = letterBalances
      .filter(balance => {
        const uploaded = uploadedCounts[balance.serviceType] || 0;
        return uploaded < balance.totalQuantity;
      })
      .map(b => b.serviceType);
    
    // Step 6: Get all types tree
    const allTypes = await this.recommLetterTypesService.getTypesTree();
    
    // Step 7: Filter tree by available service types
    const filteredTypes = this.filterTreeByServiceTypes(allTypes, availableServiceTypes);
    
    // Step 8: Return data with summary
    return {
      data: filteredTypes,
      summary: {
        online: {
          total: onlineTotal,
          available: onlineAvailable,
        },
        paper: {
          total: paperTotal,
          available: paperAvailable,
        },
      },
    };
  }

  /**
   * Recursively filter tree nodes by allowed service types
   */
  private filterTreeByServiceTypes(
    types: RecommLetterTypeTreeNode[], 
    allowedTypes: string[]
  ): RecommLetterTypeTreeNode[] {
    return types
      .filter(t => allowedTypes.includes(t.serviceTypeCode))
      .map(t => ({
        ...t,
        children: this.filterTreeByServiceTypes(t.children, allowedTypes)
      }));
  }
}

