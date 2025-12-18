import { ClassMentorPrice } from "@infrastructure/database/schema";
import { ClassMentorPriceStatus } from "@shared/types/financial-enums";
import type {
  CreateClassMentorPriceDto,
  UpdateClassMentorPriceDto,
} from "../dto";

/**
 * Class Mentor Price Service Interface
 *
 * This interface defines the contract for class mentor price management operations
 */
export interface IClassMentorPriceService {
  /**
   * Create a new class mentor price record
   *
   * @param dto - Create class mentor price DTO
   * @param updatedBy - User ID who created the price
   * @returns Created class mentor price record
   */
  createClassMentorPrice(
    dto: CreateClassMentorPriceDto,
    updatedBy?: string,
  ): Promise<ClassMentorPrice>;

  /**
   * Update an existing class mentor price record
   *
   * @param id - Class mentor price ID
   * @param dto - Update class mentor price DTO
   * @param updatedBy - User ID who updated the price
   * @returns Updated class mentor price record
   */
  updateClassMentorPrice(
    id: string,
    dto: UpdateClassMentorPriceDto,
    updatedBy?: string,
  ): Promise<ClassMentorPrice>;

  /**
   * Update the status of a class mentor price record
   *
   * @param id - Class mentor price ID
   * @param status - New status (ClassMentorPriceStatus)
   * @param updatedBy - User ID who updated the status
   * @returns Updated class mentor price record
   */
  updateStatus(
    id: string,
    status: ClassMentorPriceStatus,
    updatedBy?: string,
  ): Promise<ClassMentorPrice>;

}
