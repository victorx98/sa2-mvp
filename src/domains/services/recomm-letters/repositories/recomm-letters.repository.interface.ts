/**
 * Recommendation Letters Repository Interface
 * 
 * Defines data access abstraction for recommendation letters
 */
export interface IRecommLettersRepository {
  /**
   * Count uploaded letters by student, grouped by service type
   * Excludes deleted letters
   */
  countByStudentGroupByType(studentUserId: string): Promise<Record<string, number>>;
}

/**
 * DI Token
 */
export const RECOMM_LETTERS_REPOSITORY = Symbol('RECOMM_LETTERS_REPOSITORY');

