/**
 * MentorPayableLedger Search Criteria (导师应付账款查询条件)
 * Defines filtering options for mentor payable ledger search operations
 * (定义导师应付账款查询操作的过滤选项)
 */

import { MentorPayableLedger } from '../entities/mentor-payable-ledger.entity';

export interface MentorPayableLedgerSearchCriteria {
  /** Filter by mentor ID (按导师ID过滤) */
  mentorId?: string;

  /** Filter by settlement ID (按结算ID过滤) */
  settlementId?: string;

  /** Filter by reference ID (按关联ID过滤) */
  referenceId?: string;

  /** Filter by student ID (按学生ID过滤) */
  studentId?: string;

  /** Filter by session type code (按会话类型代码过滤) */
  sessionTypeCode?: string;

  /** Filter by settlement status (按结算状态过滤: settled/unsettled) */
  settlementStatus?: 'settled' | 'unsettled';

  /** Filter by adjustment status (按调整状态过滤: original/adjustment) */
  adjustmentStatus?: 'original' | 'adjustment';

  /** Filter by creation date range (按创建日期范围过滤) */
  createdAfter?: Date;

  /** Filter by creation date range (按创建日期范围过滤) */
  createdBefore?: Date;

  /** Page number for pagination (分页页码) */
  page?: number;

  /** Page size for pagination (分页大小) */
  pageSize?: number;

  /** Sort field (排序字段) */
  sortBy?: string;

  /** Sort order (ASC/DESC) (排序顺序) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * MentorPayableLedger Search Result (导师应付账款查询结果)
 * Contains paginated mentor payable ledger data
 * (包含分页的导师应付账款数据)
 */
export interface MentorPayableLedgerSearchResult {
  /** Array of mentor payable ledgers (导师应付账款数组) */
  data: MentorPayableLedger[];

  /** Total number of ledgers matching the criteria (符合查询条件的总记录数) */
  total: number;

  /** Current page number (当前页码) */
  page: number;

  /** Page size (分页大小) */
  pageSize: number;

  /** Total number of pages (总页数) */
  totalPages: number;
}

/**
 * Dependency Injection Token for IMentorPayableLedgerRepository
 * (IMentorPayableLedgerRepository的依赖注入令牌)
 */
export const MENTOR_PAYABLE_LEDGER_REPOSITORY = Symbol('MENTOR_PAYABLE_LEDGER_REPOSITORY');

/**
 * MentorPayableLedger Repository Interface (导师应付账款仓储接口)
 * Defines data access operations for MentorPayableLedger aggregate
 * (定义MentorPayableLedger聚合的数据访问操作)
 */
export interface IMentorPayableLedgerRepository {
  /**
   * Find mentor payable ledger by ID (通过ID查找导师应付账款)
   *
   * @param id - Ledger ID (账款ID)
   * @returns MentorPayableLedger or null if not found (账款实例或null)
   */
  findById(id: string): Promise<MentorPayableLedger | null>;

  /**
   * Find mentor payable ledgers by mentor ID (通过导师ID查找导师应付账款)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns Array of mentor payable ledgers (账款数组)
   */
  findByMentorId(mentorId: string): Promise<MentorPayableLedger[]>;

  /**
   * Find unsettled ledgers for a mentor (查找导师的未结算账款)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns Array of unsettled mentor payable ledgers (未结算账款数组)
   */
  findUnsettledByMentorId(mentorId: string): Promise<MentorPayableLedger[]>;

  /**
   * Find ledgers by settlement ID (通过结算ID查找账款)
   *
   * @param settlementId - Settlement ID (结算ID)
   * @returns Array of mentor payable ledgers (账款数组)
   */
  findBySettlementId(settlementId: string): Promise<MentorPayableLedger[]>;

  /**
   * Find original ledger by reference ID (通过关联ID查找原始账款)
   *
   * @param referenceId - Reference ID (关联ID)
   * @returns MentorPayableLedger or null if not found (账款实例或null)
   */
  findOriginalByReferenceId(referenceId: string): Promise<MentorPayableLedger | null>;

  /**
   * Search mentor payable ledgers by criteria (根据条件搜索导师应付账款)
   *
   * @param criteria - Search criteria (查询条件)
   * @returns Search result with mentor payable ledgers (包含账款的查询结果)
   */
  search(criteria: MentorPayableLedgerSearchCriteria): Promise<MentorPayableLedgerSearchResult>;

  /**
   * Save a new mentor payable ledger (保存新导师应付账款)
   *
   * @param ledger - MentorPayableLedger to save (要保存的账款)
   * @returns Saved mentor payable ledger (已保存的账款)
   */
  save(ledger: MentorPayableLedger): Promise<MentorPayableLedger>;

  /**
   * Update an existing mentor payable ledger (更新现有导师应付账款)
   *
   * @param ledger - MentorPayableLedger to update (要更新的账款)
   * @returns Updated mentor payable ledger (更新后的账款)
   */
  update(ledger: MentorPayableLedger): Promise<MentorPayableLedger>;

  /**
   * Get total unsettled amount for a mentor (获取导师的未结算总额)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns Total unsettled amount (未结算总额)
   */
  getTotalUnsettledAmount(mentorId: string): Promise<number>;

  /**
   * Execute operations within a transaction (在事务中执行操作)
   *
   * @param fn - Function to execute within transaction (要在事务中执行的函数)
   * @returns Result of the transaction function (事务函数的结果)
   */
  withTransaction<T>(fn: (repo: IMentorPayableLedgerRepository) => Promise<T>): Promise<T>;
}
