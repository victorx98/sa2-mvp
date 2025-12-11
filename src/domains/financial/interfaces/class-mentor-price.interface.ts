import { ClassMentorPrice } from "@infrastructure/database/schema";

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
   * @param status - New status (active or deleted)
   * @param updatedBy - User ID who updated the status
   * @returns Updated class mentor price record
   */
  updateStatus(
    id: string,
    status: "active" | "deleted",
    updatedBy?: string,
  ): Promise<ClassMentorPrice>;

  /**
   * Get class mentor price by ID
   *
   * @param id - Class mentor price ID
   * @returns Class mentor price record or null if not found
   */
  getClassMentorPriceById(
    id: string,
  ): Promise<ClassMentorPrice | null>;

  /**
   * Get class mentor price by class ID and mentor user ID
   *
   * @param classId - Class ID
   * @param mentorUserId - Mentor user ID
   * @returns Class mentor price record or null if not found
   */
  getClassMentorPriceByClassAndMentor(
    classId: string,
    mentorUserId: string,
  ): Promise<ClassMentorPrice | null>;

  /**
   * Search class mentor prices with filters and pagination
   *
   * @param filter - Filter criteria
   * @param pagination - Pagination options
   * @param sort - Sorting options
   * @returns Paginated list of class mentor prices
   */
  searchClassMentorPrices(
    filter: ClassMentorPriceFilterDto,
    pagination?: {
      page: number;
      pageSize: number;
    },
    sort?: {
      field: string;
      order: "asc" | "desc";
    },
  ): Promise<{
    data: ClassMentorPrice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
}

/**
 * Create Class Mentor Price DTO
 *
 * This DTO defines the data structure for creating class mentor price records
 */
export interface CreateClassMentorPriceDto {
  classId: string;
  mentorUserId: string;
  pricePerSession: number;
}

/**
 * Update Class Mentor Price DTO
 *
 * This DTO defines the data structure for updating class mentor price records
 */
export interface UpdateClassMentorPriceDto {
  pricePerSession?: number;
}

/**
 * Class Mentor Price Filter DTO
 *
 * This DTO defines the data structure for filtering class mentor price records
 */
export interface ClassMentorPriceFilterDto {
  classId?: string;
  mentorUserId?: string;
  status?: string;
}
