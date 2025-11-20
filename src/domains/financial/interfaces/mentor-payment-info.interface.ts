import {
  CreateOrUpdateMentorPaymentInfoRequest,
  MentorPaymentInfoResponse,
} from "../dto/settlement";

/**
 * Mentor Payment Info Service Interface (导师支付信息服务接口)
 *
 * Main responsibilities:
 * - Manage mentor payment information (managing mentor payment information)
 * - Support multiple payment methods (supporting multiple payment methods)
 * - Validate payment information (validating payment information)
 * - Enable/disable payment information (enabling or disabling payment information)
 *
 * 主要职责：
 * - 管理导师支付信息
 * - 支持多种支付方式
 * - 验证支付信息
 * - 启用/禁用支付信息
 */
export interface IMentorPaymentInfoService {
  /**
   * Create or update mentor payment info (创建或更新导师支付信息)
   *
   * Creates a new payment info record if one doesn't exist for the mentor.
   * Updates existing record if payment info already exists.
   * Ensures only one ACTIVE payment info per mentor.
   *
   * 如果不存在该导师的支付信息，则创建新记录。如果已存在，则更新记录。
   * 确保每个导师只有一条ACTIVE状态的支付信息。
   *
   * @param request - Payment info request (支付信息请求)
   * @returns Payment info response (支付信息响应)
   */
  createOrUpdateMentorPaymentInfo(
    request: CreateOrUpdateMentorPaymentInfoRequest,
  ): Promise<MentorPaymentInfoResponse>;

  /**
   * Get mentor payment info by mentor ID (根据导师ID获取支付信息)
   *
   * Retrieves the ACTIVE payment information for a specific mentor.
   * Returns null if no active payment info exists.
   *
   * 检索特定导师的ACTIVE状态支付信息。如果不存在有效支付信息，返回null。
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns Payment info response or null (支付信息响应，或null)
   */
  getMentorPaymentInfo(
    mentorId: string,
  ): Promise<MentorPaymentInfoResponse | null>;

  /**
   * Update payment info status (启用/禁用导师支付信息)
   *
   * Changes the status of a payment info record to ACTIVE or INACTIVE.
   * Used for soft deletion or reactivation.
   *
   * 将支付信息记录的状态更改为ACTIVE或INACTIVE。用于软删除或重新激活。
   *
   * @param id - Payment info ID (支付信息ID)
   * @param status - New status: ACTIVE or INACTIVE (新状态：ACTIVE或INACTIVE)
   * @param updatedBy - User ID making the update (执行更新的用户ID)
   * @returns Updated payment info response (更新后的支付信息响应)
   */
  updateStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    updatedBy: string,
  ): Promise<MentorPaymentInfoResponse>;

  /**
   * Validate mentor payment info (验证导师支付信息)
   *
   * Checks if a mentor has valid and complete payment information.
   * Verifies required fields based on payment method.
   *
   * 检查导师是否拥有有效且完整的支付信息。根据支付方式验证必填字段。
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns True if payment info is valid, false otherwise (有效返回true，否则false)
   */
  validateMentorPaymentInfo(mentorId: string): Promise<boolean>;
}
