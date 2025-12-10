import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import type { IMentorPaymentInfoService } from "../interfaces/mentor-payment-info.interface";
import type {
  ICreateOrUpdateMentorPaymentInfoRequest,
  IMentorPaymentInfoResponse,
} from "../dto/settlement/mentor-payment-info.dtos";
import { SettlementMethod } from "../dto/settlement/settlement.enums";

/**
 * Mentor Payment Info Service Implementation (导师支付信息服务实现)
 *
 * Manages mentor payment information including payment methods,
 * currencies, and payment details for different payment types.
 * Supports multiple payment methods with flexible JSON storage.
 *
 * 管理导师支付信息，包括支付方式、币种和不同支付类型的支付详情。
 * 支持多种支付方式，使用灵活的JSON存储。
 */
@Injectable()
export class MentorPaymentInfoService implements IMentorPaymentInfoService {
  private readonly logger = new Logger(MentorPaymentInfoService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create or update mentor payment info (创建或更新导师支付信息)
   *
   * Creates a new payment info record if it doesn't exist for the mentor
   * or updates the existing record. Ensures only one ACTIVE payment info per mentor.
   *
   * 为导师创建新的支付信息记录，或更新现有记录。
   * 确保每个导师只有一条ACTIVE状态的支付信息。
   *
   * @param request - Payment info request (支付信息请求)
   * @returns Payment info response (支付信息响应)
   */
  public async createOrUpdateMentorPaymentInfo(
    request: ICreateOrUpdateMentorPaymentInfoRequest,
  ): Promise<IMentorPaymentInfoResponse> {
    try {
      const { mentorId, paymentCurrency, paymentMethod, paymentDetails } =
        request;

      this.logger.log(
        `Creating/updating payment info for mentor: ${mentorId}, method: ${paymentMethod}`,
      );

      // 1. Validate request (验证请求)
      if (!mentorId || !paymentCurrency || !paymentMethod) {
        throw new BadRequestException(
          "Mentor ID, payment currency, and payment method are required",
        );
      }

      if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
        throw new BadRequestException("Payment details are required");
      }

      // 2. Check for existing payment info (检查现有支付信息)
      const existingPaymentInfo =
        await this.db.query.mentorPaymentInfos.findFirst({
          where: eq(schema.mentorPaymentInfos.mentorId, mentorId),
        });

      if (existingPaymentInfo) {
        // Update existing record (更新现有记录)
        this.logger.log(
          `Updating existing payment info: ${existingPaymentInfo.id}`,
        );

        const [updated] = await this.db
          .update(schema.mentorPaymentInfos)
          .set({
            paymentCurrency,
            paymentMethod,
            paymentDetails,
            status: "ACTIVE",
            updatedAt: new Date(),
            updatedBy: mentorId, // Assume mentor updates their own info
          })
          .where(eq(schema.mentorPaymentInfos.id, existingPaymentInfo.id))
          .returning();

        if (!updated) {
          throw new Error("Failed to update payment info");
        }

        return {
          id: updated.id,
          mentorId: updated.mentorId,
          paymentCurrency: updated.paymentCurrency,
          paymentMethod: updated.paymentMethod as SettlementMethod,
          paymentDetails: updated.paymentDetails as Record<string, unknown>,
          status: updated.status,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      } else {
        // Create new record (创建新记录)
        this.logger.log(`Creating new payment info for mentor: ${mentorId}`);

        const [created] = await this.db
          .insert(schema.mentorPaymentInfos)
          .values({
            mentorId,
            paymentCurrency,
            paymentMethod,
            paymentDetails,
            status: "ACTIVE",
            createdBy: mentorId,
            updatedBy: mentorId,
          })
          .returning();

        if (!created) {
          throw new Error("Failed to create payment info");
        }

        return {
          id: created.id,
          mentorId: created.mentorId,
          paymentCurrency: created.paymentCurrency,
          paymentMethod: created.paymentMethod as SettlementMethod,
          paymentDetails: created.paymentDetails as Record<string, unknown>,
          status: created.status,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error creating/updating payment info for mentor: ${request.mentorId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get mentor payment info by mentor ID (根据导师ID获取支付信息)
   *
   * Retrieves the ACTIVE payment information for a specific mentor.
   *
   * 检索特定导师的ACTIVE状态支付信息。
   *
   * @param mentorId - Mentor ID (导师ID)
   * @returns Payment info response or null (支付信息响应，或null)
   */
  public async getMentorPaymentInfo(
    mentorId: string,
  ): Promise<IMentorPaymentInfoResponse | null> {
    try {
      if (!mentorId) {
        throw new BadRequestException("Mentor ID is required");
      }

      const paymentInfo = await this.db.query.mentorPaymentInfos.findFirst({
        where: and(
          eq(schema.mentorPaymentInfos.mentorId, mentorId),
          eq(schema.mentorPaymentInfos.status, "ACTIVE"),
        ),
      });

      if (!paymentInfo) {
        this.logger.warn(
          `No active payment info found for mentor: ${mentorId}`,
        );
        return null;
      }

      return {
        id: paymentInfo.id,
        mentorId: paymentInfo.mentorId,
        paymentCurrency: paymentInfo.paymentCurrency,
        paymentMethod: paymentInfo.paymentMethod as SettlementMethod,
        paymentDetails: paymentInfo.paymentDetails as Record<string, unknown>,
        status: paymentInfo.status,
        createdAt: paymentInfo.createdAt,
        updatedAt: paymentInfo.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error getting payment info for mentor: ${mentorId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Update payment info status (启用/禁用导师支付信息)
   *
   * Changes the status of a payment info record to ACTIVE or INACTIVE.
   *
   * 将支付信息记录的状态更改为ACTIVE或INACTIVE。
   *
   * @param id - Payment info ID (支付信息ID)
   * @param status - New status: ACTIVE or INACTIVE (新状态：ACTIVE或INACTIVE)
   * @param updatedBy - User ID making the update (执行更新的用户ID)
   * @returns Updated payment info response (更新后的支付信息响应)
   */
  public async updateStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    updatedBy: string,
  ): Promise<IMentorPaymentInfoResponse> {
    try {
      if (!id) {
        throw new BadRequestException("Payment info ID is required");
      }

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        throw new BadRequestException(
          "Status must be either ACTIVE or INACTIVE",
        );
      }

      this.logger.log(`Updating payment info status: ${id} -> ${status}`);

      const [updated] = await this.db
        .update(schema.mentorPaymentInfos)
        .set({
          status,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(eq(schema.mentorPaymentInfos.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundException(`Payment info not found: ${id}`);
      }

      this.logger.log(`Successfully updated payment info status: ${id}`);

      return {
        id: updated.id,
        mentorId: updated.mentorId,
        paymentCurrency: updated.paymentCurrency,
        paymentMethod: updated.paymentMethod as SettlementMethod,
        paymentDetails: updated.paymentDetails as Record<string, unknown>,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error updating payment info status: ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

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
  public async validateMentorPaymentInfo(mentorId: string): Promise<boolean> {
    try {
      if (!mentorId) {
        return false;
      }

      const paymentInfo = await this.db.query.mentorPaymentInfos.findFirst({
        where: and(
          eq(schema.mentorPaymentInfos.mentorId, mentorId),
          eq(schema.mentorPaymentInfos.status, "ACTIVE"),
        ),
      });

      if (!paymentInfo) {
        this.logger.warn(
          `Validation failed: no active payment info for mentor: ${mentorId}`,
        );
        return false;
      }

      // Validate payment details based on payment method
      const { paymentMethod, paymentDetails } = paymentInfo;

      if (!paymentDetails || typeof paymentDetails !== "object") {
        this.logger.warn(
          `Validation failed: invalid payment details for mentor: ${mentorId}`,
        );
        return false;
      }

      // Method-specific validation
      switch (paymentMethod) {
        case "DOMESTIC_TRANSFER": {
          const details = paymentDetails as {
            bankName?: string;
            accountNumber?: string;
            accountHolder?: string;
          };
          if (
            !details.bankName ||
            !details.accountNumber ||
            !details.accountHolder
          ) {
            this.logger.warn(
              `Validation failed: missing domestic transfer details for mentor: ${mentorId}`,
            );
            return false;
          }
          break;
        }

        case "GUSTO":
        case "GUSTO_INTERNATIONAL": {
          const details = paymentDetails as {
            employeeId?: string;
            companyId?: string;
          };
          if (!details.employeeId || !details.companyId) {
            this.logger.warn(
              `Validation failed: missing Gusto details for mentor: ${mentorId}`,
            );
            return false;
          }
          break;
        }

        case "CHECK": {
          const details = paymentDetails as {
            payee?: string;
            address?: string;
          };
          if (!details.payee || !details.address) {
            this.logger.warn(
              `Validation failed: missing check details for mentor: ${mentorId}`,
            );
            return false;
          }
          break;
        }

        case "CHANNEL_BATCH_PAY":
          // Requires channel-specific details
          break;

        default:
          this.logger.warn(
            `Validation failed: unknown payment method for mentor: ${mentorId}`,
          );
          return false;
      }

      this.logger.log(`Payment info validation passed for mentor: ${mentorId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error validating payment info for mentor: ${mentorId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
