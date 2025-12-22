/**
 * MentorPaymentInfo Repository Interface (导师支付信息仓储接口)
 * Defines data access operations for MentorPaymentInfo aggregate
 * (定义MentorPaymentInfo聚合的数据访问操作)
 */

import { MentorPaymentInfo } from '../entities/mentor-payment-info.entity';

/**
 * Dependency Injection Token for IMentorPaymentInfoRepository
 * (IMentorPaymentInfoRepository的依赖注入令牌)
 */
export const MENTOR_PAYMENT_INFO_REPOSITORY = Symbol('MENTOR_PAYMENT_INFO_REPOSITORY');

export interface IMentorPaymentInfoRepository {
  /**
   * Find mentor payment info by ID (通过ID查找导师支付信息)
   *
   * @param id - Payment info ID (支付信息ID)
   * @returns MentorPaymentInfo or null if not found (支付信息实例或null)
   */
  findById(id: string): Promise<MentorPaymentInfo | null>;

  /**
   * Find active payment info for a mentor (查找导师的有效支付信息)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns MentorPaymentInfo or null if not found (支付信息实例或null)
   */
  findActiveByMentorId(mentorId: string): Promise<MentorPaymentInfo | null>;

  /**
   * Find all payment infos for a mentor (查找导师的所有支付信息)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns Array of mentor payment infos (支付信息数组)
   */
  findAllByMentorId(mentorId: string): Promise<MentorPaymentInfo[]>;

  /**
   * Save a new mentor payment info (保存新导师支付信息)
   *
   * @param paymentInfo - MentorPaymentInfo to save (要保存的支付信息)
   * @returns Saved mentor payment info (已保存的支付信息)
   */
  save(paymentInfo: MentorPaymentInfo): Promise<MentorPaymentInfo>;

  /**
   * Update an existing mentor payment info (更新现有导师支付信息)
   *
   * @param paymentInfo - MentorPaymentInfo to update (要更新的支付信息)
   * @returns Updated mentor payment info (更新后的支付信息)
   */
  update(paymentInfo: MentorPaymentInfo): Promise<MentorPaymentInfo>;

  /**
   * Execute operations within a transaction (在事务中执行操作)
   *
   * @param fn - Function to execute within transaction (要在事务中执行的函数)
   * @returns Result of the transaction function (事务函数的结果)
   */
  withTransaction<T>(fn: (repo: IMentorPaymentInfoRepository) => Promise<T>): Promise<T>;
}
