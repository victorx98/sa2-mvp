import { RecommLetterTypeEntity } from '../entities/recomm-letter-type.entity';

/**
 * Recommendation Letter Types Repository Interface
 * 
 * Defines data access abstraction for recommendation letter types
 */
export interface IRecommLetterTypesRepository {
  /**
   * Find all recommendation letter types
   */
  findAll(): Promise<RecommLetterTypeEntity[]>;

  /**
   * Find recommendation letter type by ID
   */
  findById(id: string): Promise<RecommLetterTypeEntity | null>;

  /**
   * Find multiple recommendation letter types by IDs
   */
  findByIds(ids: string[]): Promise<RecommLetterTypeEntity[]>;

  /**
   * Find recommendation letter type by type code
   */
  findByTypeCode(typeCode: string): Promise<RecommLetterTypeEntity | null>;

  /**
   * Find recommendation letter types by service type code
   */
  findByServiceTypeCode(serviceTypeCode: string): Promise<RecommLetterTypeEntity[]>;

  /**
   * Create new recommendation letter type
   */
  create(data: Partial<RecommLetterTypeEntity>): Promise<RecommLetterTypeEntity>;

  /**
   * Delete recommendation letter type by ID (cascade delete children)
   */
  delete(id: string): Promise<void>;
}

/**
 * DI Token
 */
export const RECOMM_LETTER_TYPES_REPOSITORY = Symbol('RECOMM_LETTER_TYPES_REPOSITORY');

