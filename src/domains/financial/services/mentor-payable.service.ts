import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";

/**
 * Mentor Payable Service (导师应付账款服务)
 *
 * Implementation of mentor payable related business logic
 * (实现导师应付账款相关的业务逻辑)
 */
@Injectable()
export class MentorPayableService {
  private readonly logger = new Logger(MentorPayableService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Create per-session billing record
   * (创建按会话计费记录)
   *
   * @param payload - Service session completed event payload
   * @returns Created payable ledger record
   */
  public async createPerSessionBilling(payload: {
    sessionId?: string;
    studentId: string;
    mentorId?: string;
    sessionTypeCode: string;
    actualDurationHours: number;
    durationHours: number;
    allowBilling: boolean;
    refrenceId?: string; // Note: typo in the original type definition
  }): Promise<void> {
    try {
      const {
        sessionId,
        studentId,
        mentorId,
        sessionTypeCode,
        actualDurationHours,
        refrenceId,
      } = payload;

      this.logger.log(
        `Creating per-session billing for session: ${sessionId}`,
      );

      // Input validation
      if (!sessionId || !studentId || !mentorId || !sessionTypeCode) {
        throw new BadRequestException(
          `Missing required fields for billing creation: sessionId=${sessionId}, studentId=${studentId}, mentorId=${mentorId}, sessionTypeCode=${sessionTypeCode}`,
        );
      }

      if (!payload.allowBilling) {
        this.logger.warn(
          `Billing not allowed for session: ${sessionId}, skipping`,
        );
        return;
      }

      // Get mentor price using sessionTypeCode
      const mentorPrice = await this.db.query.mentorPrices.findFirst({
        where: and(
          eq(schema.mentorPrices.mentorId, mentorId),
          eq(schema.mentorPrices.sessionTypeCode, sessionTypeCode),
          eq(schema.mentorPrices.status, "active"),
        ),
      });

      if (!mentorPrice) {
        throw new BadRequestException(
          `No active price found for mentor: ${mentorId} and session type: ${sessionTypeCode}`,
        );
      }

      // Calculate total amount based on actual duration
      const unitPrice = Number(mentorPrice.price);
      const totalAmount = Number((unitPrice * actualDurationHours).toFixed(2));

      this.logger.log(
        `Calculated billing: session=${sessionId}, duration=${actualDurationHours}h, price=${unitPrice}, amount=${totalAmount}`,
      );

      // Insert ledger record
      // Use sessionId as referenceId (or refrenceId if provided)
      const referenceId = refrenceId || sessionId;

      await this.db.insert(schema.mentorPayableLedgers).values({
        referenceId: referenceId,
        mentorId,
        studentId,
        sessionTypeCode,
        price: mentorPrice.price,
        amount: String(totalAmount), // Convert to string to match numeric type
        currency: mentorPrice.currency || "USD",
        createdBy: mentorId,
      });

      this.logger.log(
        `Successfully created per-session billing for session: ${sessionId}, amount: ${totalAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating per-session billing for session: ${payload.sessionId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Check for duplicate billing (idempotency)
   * (检查重复计费 - 幂等性检查)
   *
   * @param referenceId - The reference ID to check
   * @returns true if duplicate exists, false otherwise
   */
  public async isDuplicate(referenceId: string): Promise<boolean> {
    try {
      if (!referenceId) return false;

      const existing = await this.db.query.mentorPayableLedgers.findFirst({
        where: and(
          eq(schema.mentorPayableLedgers.referenceId, referenceId),
          eq(schema.mentorPayableLedgers.originalId, null),
        ),
      });

      return !!existing;
    } catch (error) {
      this.logger.error(
        `Error checking duplicate billing for referenceId: ${referenceId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get mentor price configuration
   * (获取导师价格配置)
   *
   * @param mentorId - Mentor ID
   * @param sessionTypeCode - Session type code
   * @returns Mentor price or null
   */
  public async getMentorPrice(
    mentorId: string,
    sessionTypeCode: string,
  ): Promise<typeof schema.mentorPrices.$inferSelect | null> {
    try {
      if (!mentorId || !sessionTypeCode) {
        this.logger.warn(
          "Empty mentorId or sessionTypeCode provided to getMentorPrice",
        );
        return null;
      }

      const mentorPrice = await this.db.query.mentorPrices.findFirst({
        where: and(
          eq(schema.mentorPrices.mentorId, mentorId),
          eq(schema.mentorPrices.sessionTypeCode, sessionTypeCode),
          eq(schema.mentorPrices.status, "active"),
        ),
      });

      return mentorPrice || null;
    } catch (error) {
      this.logger.error(
        `Error getting mentor price for mentor: ${mentorId}, session type: ${sessionTypeCode}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Adjust payable ledger (create adjustment record for chain adjustment)
   * (调整应付账款 - 创建调整记录实现链式调整)
   *
   * @param params - Adjustment parameters
   */
  public async adjustPayableLedger(params: {
    originalLedgerId: string;
    adjustmentAmount: number;
    reason: string;
    createdBy: string;
  }): Promise<void> {
    try {
      const { originalLedgerId, adjustmentAmount, reason, createdBy } = params;

      this.logger.log(`Adjusting payable ledger: ${originalLedgerId}`);

      // Query original record
      const originalLedger =
        await this.db.query.mentorPayableLedgers.findFirst({
          where: eq(schema.mentorPayableLedgers.id, originalLedgerId),
        });

      if (!originalLedger) {
        throw new BadRequestException(
          `Original ledger not found: ${originalLedgerId}`,
        );
      }

      // Create adjustment record
      await this.db.insert(schema.mentorPayableLedgers).values({
        referenceId: originalLedger.referenceId,
        mentorId: originalLedger.mentorId,
        studentId: originalLedger.studentId,
        sessionTypeCode: originalLedger.sessionTypeCode,
        price: originalLedger.price,
        amount: String(adjustmentAmount), // Convert to string to match numeric type
        currency: originalLedger.currency,
        originalId: originalLedgerId,
        adjustmentReason: reason,
        createdBy,
      });

      this.logger.log(
        `Successfully adjusted ledger: ${originalLedgerId}, adjustment amount: ${adjustmentAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adjusting payable ledger: ${params.originalLedgerId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get adjustment chain
   * (获取调整记录链)
   *
   * @param originalLedgerId - Original ledger ID
   * @returns Array of ledgers in the chain
   */
  public async getAdjustmentChain(
    originalLedgerId: string,
  ): Promise<typeof schema.mentorPayableLedgers.$inferSelect[]> {
    try {
      const chainRecords = await this.db.query.mentorPayableLedgers.findMany({
        where: eq(schema.mentorPayableLedgers.originalId, originalLedgerId),
        orderBy: [schema.mentorPayableLedgers.createdAt],
      });

      return chainRecords;
    } catch (error) {
      this.logger.error(
        `Error getting adjustment chain for ledger: ${originalLedgerId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Create placement billing record
   * (创建安置申请计费记录)
   *
   * @param payload - Placement application billing payload
   * @returns Created payable ledger record
   */
  public async createPlacementBilling(payload: {
    applicationId: string;
    studentId: string;
    mentorId: string;
    sessionTypeCode: string;
    allowBilling: boolean;
  }): Promise<void> {
    try {
      const {
        applicationId,
        studentId,
        mentorId,
        sessionTypeCode,
      } = payload;

      this.logger.log(
        `Creating placement billing for application: ${applicationId}`,
      );

      // Input validation
      if (!applicationId || !studentId || !mentorId || !sessionTypeCode) {
        throw new BadRequestException(
          `Missing required fields for billing creation: applicationId=${applicationId}, studentId=${studentId}, mentorId=${mentorId}, sessionTypeCode=${sessionTypeCode}`,
        );
      }

      if (!payload.allowBilling) {
        this.logger.warn(
          `Billing not allowed for application: ${applicationId}, skipping`,
        );
        return;
      }

      // Get mentor price using sessionTypeCode
      const mentorPrice = await this.db.query.mentorPrices.findFirst({
        where: and(
          eq(schema.mentorPrices.mentorId, mentorId),
          eq(schema.mentorPrices.sessionTypeCode, sessionTypeCode),
          eq(schema.mentorPrices.status, "active"),
        ),
      });

      if (!mentorPrice) {
        throw new BadRequestException(
          `No active price found for mentor: ${mentorId} and placement stage: ${sessionTypeCode}`,
        );
      }

      // For placement billing, use the full price as amount
      const totalAmount = Number(mentorPrice.price);

      this.logger.log(
        `Calculated placement billing: application=${applicationId}, stage=${sessionTypeCode}, price=${mentorPrice.price}, amount=${totalAmount}`,
      );

      // Insert ledger record
      // Use applicationId as referenceId
      const referenceId = applicationId;

      await this.db.insert(schema.mentorPayableLedgers).values({
        referenceId: referenceId,
        mentorId,
        studentId,
        sessionTypeCode,
        price: mentorPrice.price,
        amount: String(totalAmount), // Convert to string to match numeric type
        currency: mentorPrice.currency || "USD",
        createdBy: mentorId,
      });

      this.logger.log(
        `Successfully created placement billing for application: ${applicationId}, amount: ${totalAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating placement billing for application: ${payload.applicationId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
