import {
  ICreateSettlementRequest,
  ISettlementQuery,
  ISettlementDetailResponse,
  ISettlementResponse,
  ISettlementDetailItem,
} from "../dto/settlement";

/**
 * Settlement Service Interface (结算服务接口)
 *
 * Main responsibilities:
 * - Generate settlement bills (generating settlement bills for mentors)
 * - Query settlement records (support querying by ID, mentor, and month)
 * - Provide pagination query functionality (providing pagination for settlement records)
 * - Does NOT include settlement completion or cancellation functionality
 * - Uses append-only mode for managing settlement records
 *
 * 主要职责：
 * - 生成结算账单（为导师生成结算账单）
 * - 查询结算记录（支持按ID、导师和月份查询）
 * - 提供分页查询功能（提供结算记录的分页查询）
 * - 不包含完成结算和取消结算功能
 * - 采用append-only模式管理结算记录
 */
export interface ISettlementService {
  /**
   * Generate settlement bill (生成结算账单)
   *
   * Creates a settlement record for a mentor for a specific month.
   * The settlement record is created in CONFIRMED status immediately.
   * Calculates amounts based on exchange rate and deduction rate.
   * Creates settlement detail records linking to payable ledgers.
   * Publishes settlement confirmed event.
   *
   * 为导师创建特定月份的结算记录。结算记录创建后立即进入CONFIRMED状态。
   * 根据汇率和扣除比率计算金额。创建链接到应付账款的结算明细记录。
   * 发布结算确认事件。
   *
   * @param request - Settlement request parameters (结算请求参数)
   * @param createdBy - Creator user ID (创建人用户ID)
   * @returns Settlement record details (结算记录详情)
   */
  generateSettlement(
    request: ICreateSettlementRequest,
    createdBy: string,
  ): Promise<ISettlementDetailResponse>;

  /**
   * Get settlement by ID (根据ID获取结算记录)
   *
   * Retrieves a settlement record by its unique identifier.
   * Returns detailed information including creator information.
   *
   * 通过唯一标识符检索结算记录。返回包含创建人信息的详细信息。
   *
   * @param id - Settlement ID (结算ID)
   * @returns Settlement record details or null if not found (结算记录详情，未找到返回null)
   */
  getSettlementById(id: string): Promise<ISettlementDetailResponse | null>;

  /**
   * Get settlement by mentor and month (根据导师ID和月份获取结算记录)
   *
   * Retrieves a settlement record for a specific mentor and month.
   * Each mentor can have only one settlement per month.
   *
   * 检索特定导师和月份的结算记录。每个导师每月只能有一条结算记录。
   *
   * @param mentorId - Mentor ID (导师ID)
   * @param settlementMonth - Settlement month in YYYY-MM format (结算月份，格式YYYY-MM)
   * @returns Settlement record details or null if not found (结算记录详情，未找到返回null)
   */
  getSettlementByMentorAndMonth(
    mentorId: string,
    settlementMonth: string,
  ): Promise<ISettlementDetailResponse | null>;

  /**
   * Find settlements with pagination (分页查询结算记录)
   *
   * Queries settlement records based on provided filters.
   * Supports filtering by mentor, month, date range, and pagination.
   *
   * 根据提供的筛选器查询结算记录。支持按导师、月份、日期范围和分页筛选。
   *
   * @param query - Query parameters including filters and pagination (查询参数，包括筛选器和分页)
   * @returns Paginated settlement records (分页的结算记录)
   */
  findSettlements(
    query: ISettlementQuery,
  ): Promise<{ data: ISettlementResponse[]; total: number }>;

  /**
   * Get settlement details (获取结算明细列表)
   *
   * Retrieves all settlement detail records for a specific settlement.
   * Settlement details link the settlement to payable ledgers.
   *
   * 检索特定结算的所有结算明细记录。结算明细将结算记录链接到应付账款。
   *
   * @param settlementId - Settlement record ID (结算记录ID)
   * @returns Array of settlement detail records (结算明细记录数组)
   */
  getSettlementDetails(settlementId: string): Promise<ISettlementDetailItem[]>;
}
