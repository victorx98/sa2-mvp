import { CreateMentorPriceDto } from "../dto/create-mentor-price.dto";
import { UpdateMentorPriceDto } from "../dto/update-mentor-price.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Mentor Price Service Interface[导师价格服务接口]
 *
 * This interface defines the contract for mentor price management operations[此接口定义了导师价格管理操作的契约]
 */
export interface IMentorPriceService {
  /**
   * Get mentor price by mentor user ID and session type code[根据导师用户ID和会话类型代码获取导师价格]
   *
   * @param mentorUserId - Mentor user ID[导师用户ID]
   * @param sessionTypeCode - Session type code[会话类型代码]
   * @returns Mentor price record or null if not found[导师价格记录或未找到时返回null]
   */
  getMentorPrice(
    mentorUserId: string,
    sessionTypeCode: string,
  ): Promise<MentorPrice | null>;

  /**
   * Create a new mentor price record[创建新的导师价格记录]
   *
   * @param dto - Create mentor price DTO[创建导师价格DTO]
   * @param updatedBy - User ID who created the price[创建价格的用户ID]
   * @returns Created mentor price record[创建的导师价格记录]
   */
  createMentorPrice(
    dto: CreateMentorPriceDto,
    updatedBy?: string,
  ): Promise<MentorPrice>;

  /**
   * Update an existing mentor price record[更新现有的导师价格记录]
   *
   * @param id - Mentor price ID[导师价格ID]
   * @param dto - Update mentor price DTO[更新导师价格DTO]
   * @param updatedBy - User ID who updated the price[更新价格的用户ID]
   * @returns Updated mentor price record[更新后的导师价格记录]
   */
  updateMentorPrice(
    id: string,
    dto: UpdateMentorPriceDto,
    updatedBy?: string,
  ): Promise<MentorPrice>;

  /**
   * Update mentor price status[更新导师价格状态]
   *
   * @param id - Mentor price ID[导师价格ID]
   * @param status - Status to update (active/inactive)[要更新的状态(active/inactive)]
   * @param updatedBy - User ID who updated the status[更新状态的用户ID]
   */
  updateMentorPriceStatus(
    id: string,
    status: "active" | "inactive",
    updatedBy?: string,
  ): Promise<void>;

  /**
   * Search mentor prices with filters and pagination[使用过滤器和分页搜索导师价格]
   *
   * @param filter - Filter criteria[过滤条件]
   * @param pagination - Pagination options[分页选项]
   * @param sort - Sorting options[排序选项]
   * @returns Paginated list of mentor prices[分页的导师价格列表]
   */
  searchMentorPrices(
    filter: {
      mentorUserId?: string;
      sessionTypeCode?: string;
      status?: string;
      packageCode?: string;
    },
    pagination?: {
      page: number;
      pageSize: number;
    },
    sort?: {
      field: string;
      order: "asc" | "desc";
    },
  ): Promise<{
    data: MentorPrice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;

  /**
   * Bulk create mentor price records[批量创建导师价格记录]
   *
   * @param dtos - Array of create mentor price DTOs[创建导师价格DTO数组]
   * @param createdBy - User ID who created the prices[创建价格的用户ID]
   * @returns Array of created mentor price records[创建的导师价格记录数组]
   */
  batchCreateMentorPrices(
    dtos: CreateMentorPriceDto[],
    createdBy?: string,
  ): Promise<MentorPrice[]>;

  /**
   * Bulk update mentor price records[批量更新导师价格记录]
   *
   * @param updates - Array of update mentor price objects[更新导师价格对象数组]
   * @param updatedBy - User ID who updated the prices[更新价格的用户ID]
   * @returns Array of updated mentor price records[更新后的导师价格记录数组]
   */
  batchUpdateMentorPrices(
    updates: Array<{ id: string; dto: UpdateMentorPriceDto }>,
    updatedBy?: string,
  ): Promise<MentorPrice[]>;
}
