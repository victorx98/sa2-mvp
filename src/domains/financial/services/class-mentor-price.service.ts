/**
 * Class Mentor Price Service
 *
 * This service implements the contract for class mentor price management operations
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { ClassMentorPriceStatus } from "@shared/types/financial-enums";
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
          eq(schema.classMentorsPrices.status, ClassMentorPriceStatus.ACTIVE),
        ),
      });

      if (existingPrice) {
        throw new FinancialConflictException(
          "CLASS_MENTOR_PRICE_ALREADY_EXISTS",
          FINANCIAL_ERROR_MESSAGES.CLASS_MENTOR_PRICE_ALREADY_EXISTS,
        );
      }

      // Create class mentor price record
      const insertValues = {
        classId: dto.classId,
        mentorUserId: dto.mentorUserId,
        pricePerSession: dto.pricePerSession,
        status: ClassMentorPriceStatus.ACTIVE,
        updatedAt: new Date(),
      };
      const [createdPrice] = await this.db
        .insert(schema.classMentorsPrices)
        .values(insertValues)
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
      // Check if class mentor price exists and is active
      const existingPrice = await this.db.query.classMentorsPrices.findFirst({
        where: and(
          eq(schema.classMentorsPrices.id, id),
          eq(schema.classMentorsPrices.status, ClassMentorPriceStatus.ACTIVE),
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
            dto.pricePerSession !== undefined ? dto.pricePerSession : existingPrice.pricePerSession,
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
    status: ClassMentorPriceStatus,
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
      if (status === ClassMentorPriceStatus.ACTIVE) {
        // Check if there's already an active price for this class and mentor
        const activePrice = await this.db.query.classMentorsPrices.findFirst({
          where: and(
            eq(schema.classMentorsPrices.classId, existingPrice.classId),
            eq(schema.classMentorsPrices.mentorUserId, existingPrice.mentorUserId),
            eq(schema.classMentorsPrices.status, ClassMentorPriceStatus.ACTIVE),
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

}
