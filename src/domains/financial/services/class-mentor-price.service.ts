/**
 * Class Mentor Price Service
 *
 * This service implements the contract for class mentor price management operations
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, sql, asc, desc } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { IClassMentorPriceService } from "../interfaces/class-mentor-price.interface";
import { CreateClassMentorPriceDto } from "../dto/create-class-mentor-price.dto";
import { UpdateClassMentorPriceDto } from "../dto/update-class-mentor-price.dto";
import { ClassMentorPriceFilterDto } from "../dto/class-mentor-price-filter.dto";
import {
  FinancialException,
  FinancialNotFoundException,
  FinancialConflictException,
} from "../common/exceptions/financial.exception";
import { FINANCIAL_ERROR_MESSAGES } from "../common/exceptions/financial.exception";
import type { ClassMentorPrice } from "@infrastructure/database/schema";

@Injectable()
export class ClassMentorPriceService implements IClassMentorPriceService {
  private readonly logger = new Logger(ClassMentorPriceService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create a new class mentor price record
   *
   * @param dto - Create class mentor price DTO
   * @param updatedBy - User ID who created the price
   * @returns Created class mentor price record
   */
  public async createClassMentorPrice(
    dto: CreateClassMentorPriceDto,
    updatedBy?: string,
  ): Promise<ClassMentorPrice> {
    try {
      // Check if class mentor price already exists
      const existingPrice = await this.db.query.classMentorsPrices.findFirst({
        where: and(
          eq(schema.classMentorsPrices.classId, dto.classId),
          eq(schema.classMentorsPrices.mentorUserId, dto.mentorUserId),
          eq(schema.classMentorsPrices.status, "active"),
        ),
      });

      if (existingPrice) {
        throw new FinancialConflictException(
          "CLASS_MENTOR_PRICE_ALREADY_EXISTS",
          FINANCIAL_ERROR_MESSAGES.CLASS_MENTOR_PRICE_ALREADY_EXISTS,
        );
      }

      // Create class mentor price record
      const [createdPrice] = await this.db
        .insert(schema.classMentorsPrices)
        .values({
          classId: dto.classId,
          mentorUserId: dto.mentorUserId,
          pricePerSession: dto.pricePerSession.toString(),
          status: "active",
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Created class mentor price: ${createdPrice.id}`);

      return createdPrice;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error creating class mentor price: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_CREATE_FAILED",
        error instanceof Error ? error.message : "Failed to create class mentor price",
      );
    }
  }

  /**
   * Update an existing class mentor price record
   *
   * @param id - Class mentor price ID
   * @param dto - Update class mentor price DTO
   * @param updatedBy - User ID who updated the price
   * @returns Updated class mentor price record
   */
  public async updateClassMentorPrice(
    id: string,
    dto: UpdateClassMentorPriceDto,
    updatedBy?: string,
  ): Promise<ClassMentorPrice> {
    try {
      // Check if class mentor price exists
      const existingPrice = await this.db.query.classMentorsPrices.findFirst({
        where: and(
          eq(schema.classMentorsPrices.id, id),
          eq(schema.classMentorsPrices.status, "active"),
        ),
      });

      if (!existingPrice) {
        throw new FinancialNotFoundException(
          "CLASS_MENTOR_PRICE_NOT_FOUND",
          FINANCIAL_ERROR_MESSAGES.CLASS_MENTOR_PRICE_NOT_FOUND,
        );
      }

      // Update class mentor price record
      const [updatedPrice] = await this.db
        .update(schema.classMentorsPrices)
        .set({
          pricePerSession:
            dto.pricePerSession !== undefined ? dto.pricePerSession.toString() : existingPrice.pricePerSession,
          updatedAt: new Date(),
        })
        .where(eq(schema.classMentorsPrices.id, id))
        .returning();

      this.logger.log(`Updated class mentor price: ${id}`);

      return updatedPrice;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error updating class mentor price: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_UPDATE_FAILED",
        error instanceof Error ? error.message : "Failed to update class mentor price",
      );
    }
  }

  /**
   * Update the status of a class mentor price record
   *
   * @param id - Class mentor price ID
   * @param status - New status (active or deleted)
   * @param updatedBy - User ID who updated the status
   * @returns Updated class mentor price record
   */
  public async updateStatus(
    id: string,
    status: "active" | "deleted",
    updatedBy?: string,
  ): Promise<ClassMentorPrice> {
    try {
      // Check if class mentor price exists
      const existingPrice = await this.db.query.classMentorsPrices.findFirst({
        where: eq(schema.classMentorsPrices.id, id),
      });

      if (!existingPrice) {
        throw new FinancialNotFoundException(
          "CLASS_MENTOR_PRICE_NOT_FOUND",
          FINANCIAL_ERROR_MESSAGES.CLASS_MENTOR_PRICE_NOT_FOUND,
        );
      }

      // If status is already the same, return the existing price
      if (existingPrice.status === status) {
        this.logger.warn(`Class mentor price ${id} is already ${status}, skipping update`);
        return existingPrice;
      }

      // Additional checks for status transitions
      if (status === "active") {
        // Check if there's already an active price for this class and mentor
        const activePrice = await this.db.query.classMentorsPrices.findFirst({
          where: and(
            eq(schema.classMentorsPrices.classId, existingPrice.classId),
            eq(schema.classMentorsPrices.mentorUserId, existingPrice.mentorUserId),
            eq(schema.classMentorsPrices.status, "active"),
          ),
        });

        if (activePrice) {
          throw new FinancialConflictException(
            "CLASS_MENTOR_PRICE_ALREADY_EXISTS",
            FINANCIAL_ERROR_MESSAGES.CLASS_MENTOR_PRICE_ALREADY_EXISTS,
          );
        }
      }

      // Update status
      const [updatedPrice] = await this.db
        .update(schema.classMentorsPrices)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(schema.classMentorsPrices.id, id))
        .returning();

      this.logger.log(`Updated class mentor price status: ${id}, new status: ${status}`);

      return updatedPrice;
    } catch (error) {
      if (error instanceof FinancialException) {
        throw error;
      }
      this.logger.error(
        `Error updating class mentor price status: ${id}, status: ${status}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_STATUS_UPDATE_FAILED",
        error instanceof Error ? error.message : "Failed to update class mentor price status",
      );
    }
  }

  /**
   * Get class mentor price by ID
   *
   * @param id - Class mentor price ID
   * @returns Class mentor price record or null if not found
   */
  public async getClassMentorPriceById(
    id: string,
  ): Promise<ClassMentorPrice | null> {
    try {
      const price = await this.db.query.classMentorsPrices.findFirst({
        where: eq(schema.classMentorsPrices.id, id),
      });

      return price;
    } catch (error) {
      this.logger.error(
        `Error getting class mentor price by ID: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_GET_FAILED",
        error instanceof Error ? error.message : "Failed to get class mentor price",
      );
    }
  }

  /**
   * Get class mentor price by class ID and mentor user ID
   *
   * @param classId - Class ID
   * @param mentorUserId - Mentor user ID
   * @returns Class mentor price record or null if not found
   */
  public async getClassMentorPriceByClassAndMentor(
    classId: string,
    mentorUserId: string,
  ): Promise<ClassMentorPrice | null> {
    try {
      const price = await this.db.query.classMentorsPrices.findFirst({
        where: and(
          eq(schema.classMentorsPrices.classId, classId),
          eq(schema.classMentorsPrices.mentorUserId, mentorUserId),
        ),
      });

      return price;
    } catch (error) {
      this.logger.error(
        `Error getting class mentor price by class and mentor: classId=${classId}, mentorUserId=${mentorUserId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_GET_FAILED",
        error instanceof Error ? error.message : "Failed to get class mentor price",
      );
    }
  }

  /**
   * Search class mentor prices with filters and pagination
   *
   * @param filter - Filter criteria
   * @param pagination - Pagination options
   * @param sort - Sorting options
   * @returns Paginated list of class mentor prices
   */
  public async searchClassMentorPrices(
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
  }> {
    try {
      // Build filter conditions
      const conditions = [];
      if (filter.classId) {
        conditions.push(eq(schema.classMentorsPrices.classId, filter.classId));
      }
      if (filter.mentorUserId) {
        conditions.push(
          eq(schema.classMentorsPrices.mentorUserId, filter.mentorUserId),
        );
      }
      if (filter.status) {
        conditions.push(eq(schema.classMentorsPrices.status, filter.status));
      }

      // Build where clause
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Calculate total count
      const total = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.classMentorsPrices)
        .where(whereClause)
        .then((result) => result[0].count || 0);

      // Set default pagination values if not provided
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 20;
      const offset = (page - 1) * pageSize;
      const totalPages = Math.ceil(total / pageSize);

      // Build sort clause
      const sortField = sort?.field || "createdAt";
      const sortOrder = sort?.order || "desc";
      
      // Only allow valid column names for sorting
      const validSortFields = ["createdAt", "updatedAt", "pricePerSession"];
      const finalSortField = validSortFields.includes(sortField)
        ? sortField
        : "createdAt";
      
      // Build order by clause
      let orderBy;
      if (finalSortField === "createdAt") {
        orderBy = sortOrder === "asc" ? asc(schema.classMentorsPrices.createdAt) : desc(schema.classMentorsPrices.createdAt);
      } else if (finalSortField === "updatedAt") {
        orderBy = sortOrder === "asc" ? asc(schema.classMentorsPrices.updatedAt) : desc(schema.classMentorsPrices.updatedAt);
      } else {
        orderBy = sortOrder === "asc" ? asc(schema.classMentorsPrices.pricePerSession) : desc(schema.classMentorsPrices.pricePerSession);
      }

      // Get paginated data
      const data = await this.db
        .select()
        .from(schema.classMentorsPrices)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset);

      this.logger.log(`Searched class mentor prices: total=${total}, page=${page}, pageSize=${pageSize}`);

      return {
        data,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Error searching class mentor prices: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new FinancialException(
        "CLASS_MENTOR_PRICE_SEARCH_FAILED",
        error instanceof Error ? error.message : "Failed to search class mentor prices",
      );
    }
  }
}
