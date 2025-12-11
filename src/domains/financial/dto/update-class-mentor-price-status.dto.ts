/**
 * Update Class Mentor Price Status DTO
 * [更新班级导师价格状态DTO]
 *
 * Used for updating class mentor price status
 * [用于更新班级导师价格状态]
 */

export class UpdateClassMentorPriceStatusDto {
  /**
   * New status for the class mentor price
   * [班级导师价格的新状态]
   *
   * @example active
   */
  status: 'active' | 'deleted';
}
