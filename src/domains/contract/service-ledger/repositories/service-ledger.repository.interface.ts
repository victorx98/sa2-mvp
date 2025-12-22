/**
 * ServiceLedger Repository Interface (服务流水仓库接口)
 * Defines data access operations for ServiceLedger aggregates (定义ServiceLedger聚合的数据访问操作)
 */

import { ServiceLedger } from '../entities/service-ledger.entity';

/**
 * Search criteria for service ledgers (服务流水搜索条件)
 */
export interface ServiceLedgerSearchCriteria {
  studentId?: string;
  serviceType?: string;
  startDate?: Date;
  endDate?: Date;
  type?: string;
  source?: string;
}

/**
 * Search result for service ledgers (服务流水搜索结果)
 */
export interface ServiceLedgerSearchResult {
  data: ServiceLedger[];
  total: number;
}

/**
 * Service ledger repository interface (服务流水仓库接口)
 */
export interface IServiceLedgerRepository {
  /**
   * Find a ledger entry by ID (通过ID查找流水条目)
   *
   * @param id - Ledger entry ID (流水条目ID)
   * @returns ServiceLedger or null if not found (ServiceLedger，未找到时返回null)
   */
  findById(id: string): Promise<ServiceLedger | null>;

  /**
   * Find ledger entries for a student and service type (查找学生和服务类型的流水条目)
   *
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @returns Array of ServiceLedger entries (ServiceLedger条目数组)
   */
  findByStudentAndServiceType(
    studentId: string,
    serviceType: string,
  ): Promise<ServiceLedger[]>;

  /**
   * Find the most recent ledger entry for a student and service type (查找学生和服务类型的最新流水条目)
   *
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @returns Most recent ServiceLedger or null if not found (最新的ServiceLedger，未找到时返回null)
   */
  findLatestByStudentAndServiceType(
    studentId: string,
    serviceType: string,
  ): Promise<ServiceLedger | null>;

  /**
   * Search ledger entries with criteria (按条件搜索流水条目)
   *
   * @param criteria - Search criteria (搜索条件)
   * @returns Search result with matching entries (搜索结果，包含匹配的条目)
   */
  search(criteria: ServiceLedgerSearchCriteria): Promise<ServiceLedgerSearchResult>;

  /**
   * Save a new ledger entry (保存新流水条目)
   *
   * @param ledger - ServiceLedger to save (要保存的ServiceLedger)
   * @returns Saved ServiceLedger (保存后的ServiceLedger)
   */
  save(ledger: ServiceLedger): Promise<ServiceLedger>;

  /**
   * Calculate current balance for a student and service type (计算学生和服务类型的当前余额)
   *
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @returns Current balance (当前余额)
   */
  calculateBalance(studentId: string, serviceType: string): Promise<number>;

  /**
   * Execute a function within a transaction (在事务中执行函数)
   *
   * @param fn - Function to execute (要执行的函数)
   * @returns Result of the function (函数的执行结果)
   */
  withTransaction<T>(fn: (repo: IServiceLedgerRepository) => Promise<T>): Promise<T>;
}
