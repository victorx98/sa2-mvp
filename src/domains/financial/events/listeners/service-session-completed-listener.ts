import { Injectable, Logger, Inject, BadRequestException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IServiceSessionCompletedEvent,
  SERVICE_SESSION_COMPLETED_EVENT,
} from "@shared/events/service-session-completed.event";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";

/**
 * Service Session Completed Event Listener (服务会话完成事件监听器)
 *
 * Responsible for listening to service session completed events
 * and performing corresponding financial processing logic
 * (负责监听服务会话完成事件，并执行相应的财务处理逻辑)
 *
 * Flow:
 * 1. Check for duplicate events (idempotency)
 * 2. Validate event payload
 * 3. Route billing based on billing mode
 * 4. Create per-session billing record
 * 5. Calculate amount based on actual duration
 */
@Injectable()
export class ServiceSessionCompletedListener {
  private readonly logger = new Logger(ServiceSessionCompletedListener.name);

  constructor(
    @Inject("IMentorPayableService")
    private readonly mentorPayableService: MentorPayableService,
  ) {}

  /**
   * Handle service session completed event
   * (处理服务会话完成事件)
   *
   * @param event - The service session completed event data
   */
  @OnEvent(SERVICE_SESSION_COMPLETED_EVENT)
  async handleServiceSessionCompletedEvent(
    event: IServiceSessionCompletedEvent,
  ): Promise<void> {
    try {
      this.logger.log(`Received service session completed event: ${event.id}`);

      const payload = event.payload;

      // Extract required fields from payload
      const {
        sessionId,
        studentId,
        mentorId,
        refrenceId, // Note: typo in the original type definition
        sessionTypeCode,
        actualDurationHours,
        allowBilling,
      } = payload || {};

      // Validate payload
      if (!sessionId || !studentId || !mentorId || !sessionTypeCode) {
        this.logger.error(
          `Missing required fields in event payload: sessionId=${sessionId}, studentId=${studentId}, mentorId=${mentorId}, sessionTypeCode=${sessionTypeCode}`,
        );
        // [修复] Throw error instead of silently returning to allow event retry and make issues visible (抛出错误而不是静默返回，允许事件重试并使问题可见)
        throw new BadRequestException(
          `Missing required fields in event payload: sessionId=${sessionId}, studentId=${studentId}, mentorId=${mentorId}, sessionTypeCode=${sessionTypeCode}`,
        );
      }

      this.logger.log(
        `Processing session: ${sessionId}, student: ${studentId}, mentor: ${mentorId}, type: ${sessionTypeCode}, duration: ${actualDurationHours}h`,
      );

      // Enrich payload with referenceId (use sessionId if refrenceId not provided)
      const billingReferenceId = refrenceId || sessionId;

      // 1. Check for duplicate events (idempotency)
      // Idempotency: Each referenceId can only have one original billing record
      if (await this.mentorPayableService.isDuplicate(billingReferenceId)) {
        this.logger.warn(
          `Duplicate billing detected for referenceId: ${billingReferenceId}, skipping`,
        );
        return;
      }

      // 2. Check if billing is allowed
      if (allowBilling === false) {
        this.logger.warn(
          `Billing not allowed for session: ${sessionId}, skipping`,
        );
        return;
      }

      // 3. Route billing based on billing mode
      // Get mentor price to determine billing mode
      const mentorPrice = await this.mentorPayableService.getMentorPrice(
        mentorId,
        sessionTypeCode,
      );

      if (!mentorPrice) {
        this.logger.error(
          `No active price found for mentor: ${mentorId} and session type: ${sessionTypeCode}`,
        );
        // [修复] Throw error instead of silently returning to make issues visible and allow retry (抛出错误而不是静默返回，使问题可见并允许重试)
        throw new BadRequestException(
          `No active price found for mentor: ${mentorId} and session type: ${sessionTypeCode}`,
        );
      }

      this.logger.log(
        `Found mentor price: ${mentorPrice.price} ${mentorPrice.currency}, billing will be calculated based on actual duration`,
      );

      // 4. Create per-session billing record
      // For now, we only implement per-session/hour billing
      // Package billing will be handled separately when the last session completes
      await this.mentorPayableService.createPerSessionBilling(payload);

      this.logger.log(
        `Successfully processed service session event: ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process service session completed event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Throw error to ensure event is retried if needed
      throw error;
    }
  }
}
