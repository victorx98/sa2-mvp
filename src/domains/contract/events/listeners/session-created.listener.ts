import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ServiceHoldService } from "../../services/service-hold.service";

export const SESSION_CREATED_EVENT = "session.created";

/**
 * Payload for session.created event (session.created 事件的负载)
 */
export interface ISessionCreatedEvent {
  sessionId: string; // Session ID (会话ID)
  holdId: string; // Service hold ID (服务预留ID)
  contractId: string; // Contract ID (合约ID)
  studentId: string; // Student ID (学生ID)
  serviceType: string; // Service type (服务类型)
}

/**
 * Session Created Event Listener (会话创建事件监听器)
 *
 * Listens for session.created events and updates the relatedBookingId
 * of the corresponding service hold to establish the relationship
 * between hold and session.
 * (监听 session.created 事件并更新相应服务预留的 relatedBookingId，
 * 以建立预留与会话之间的关联关系)
 *
 * This implements the loose coupling between Contract Domain and Session Domain,
 * following the event-driven architecture pattern and Domain-Driven Design principles.
 * (实现了 Contract Domain 与 Session Domain 之间的松耦合，
 * 遵循事件驱动架构模式和领域驱动设计原则)
 */
@Injectable()
export class SessionCreatedListener {
  private readonly logger = new Logger(SessionCreatedListener.name);

  constructor(private readonly serviceHoldService: ServiceHoldService) {}

  /**
   * Handle session.created event (处理 session.created 事件)
   * @param event - The session created event (会话创建事件)
   */
  @OnEvent(SESSION_CREATED_EVENT, { async: true })
  async handleSessionCreated(event: ISessionCreatedEvent): Promise<void> {
    try {
      const { sessionId, holdId, contractId } = event;

      this.logger.log(
        `Processing session.created event: associate hold ${holdId} with session ${sessionId}`,
        {
          sessionId,
          holdId,
          contractId,
        },
      );

      // Update the hold with the session ID (使用 session ID 更新预留)
      await this.serviceHoldService.updateRelatedBooking(holdId, sessionId);

      this.logger.log(
        `Successfully associated hold ${holdId} with session ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to associate hold with session: ${error.message}`,
        error.stack,
        {
          event,
        },
      );

      // Re-throw to allow retry mechanism to handle (重新抛出以允许重试机制处理)
      throw error;
    }
  }
}
