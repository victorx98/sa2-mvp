import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { ContractService } from "../../services/contract.service";
import { IEventPublisher } from "../../services/event-publisher.service";
import type { ServiceType } from "../../common/types/enum.types";
import type { ISessionCompletedEvent } from "../../common/types/event.types";

/**
 * Session Completed Event Listener(会话完成事件监听器)
 *
 * Listens for session.completed events and automatically consumes service(监听session.completed事件并在导师完成会话时自动消费服务权利)
 * entitlements when a session is completed by the mentor.
 *
 * Outbox Pattern: Events are published by the Session Service and this(出站模式：事件由会话服务发布，此监听器消费它们以扣除服务权利)
 * listener consumes them to deduct service entitlements.
 */
@Injectable()
export class SessionCompletedListener implements OnModuleInit {
  private readonly logger = new Logger(SessionCompletedListener.name);

  constructor(
    private readonly contractService: ContractService,
    @Inject("EVENT_PUBLISHER") private readonly eventPublisher: IEventPublisher,
  ) {}

  onModuleInit() {
    // Subscribe to session.completed events(订阅session.completed事件)
    this.eventPublisher.subscribe("session.completed", (event: any) =>
      this.handleSessionCompleted(event),
    );

    this.logger.log("SessionCompletedListener initialized");
  }

  /**
   * Handle session.completed event(处理session.completed事件)
   * @param event The session completed event(会话完成事件)
   */
  private async handleSessionCompleted(event: ISessionCompletedEvent): Promise<void> {
    try {
      const { payload } = event;

      // Validate required fields(验证必填字段)
      if (!payload?.sessionId) {
        this.logger.warn(
          "Invalid session event: missing sessionId(无效的会话事件：缺少sessionId)",
          {
            eventId: event.id,
          },
        );
        return;
      }

      if (!payload?.contractId) {
        this.logger.warn(
          "Invalid session event: missing contractId(无效的会话事件：缺少contractId)",
          {
            eventId: event.id,
          },
        );
        return;
      }

      if (!payload?.serviceType) {
        this.logger.warn(
          "Invalid session event: missing serviceType(无效的会话事件：缺少serviceType)",
          {
            eventId: event.id,
          },
        );
        return;
      }

      if (!payload?.studentId) {
        this.logger.warn(
          "Invalid session event: missing studentId(无效的会话事件：缺少studentId)",
          {
            eventId: event.id,
          },
        );
        return;
      }

      const {
        sessionId,
        contractId,
        studentId,
        serviceType,
        holdId,
        createdBy,
      } = payload;

      this.logger.log(
        `Processing completed session: ${sessionId}(处理已完成的会话：${sessionId})`,
        {
          eventId: event.id,
          contractId,
          serviceType,
          holdId,
        },
      );

      // Prepare consume service DTO(准备消费服务DTO)
      // Mapping external event fields (sessionId, holdId) to Contract Domain DTO fields (relatedBookingId, relatedHoldId)
      // createdBy is provided by upstream system (mentorId, 'system', etc.) - Contract Domain doesn't need to know the details
      // This maintains DDD anti-corruption layer - Contract Domain uses generic terms not coupled to Session Domain
      const consumeDto = {
        contractId,
        studentId,
        serviceType: serviceType as ServiceType,
        quantity: 1, // Each completed session consumes 1 entitlement(每个已完成的会话消耗1个权利)
        relatedBookingId: sessionId, // Mapping: external sessionId -> internal relatedBookingId
        relatedHoldId: holdId, // Mapping: external holdId -> internal relatedHoldId
        createdBy, // Use createdBy directly from upstream system
      };

      // Consume the service entitlement(消费服务权利)
      await this.contractService.consumeService(consumeDto);

      this.logger.log(
        `Service consumption recorded for session ${sessionId}(会话${sessionId}的服务消费已记录)`,
        {
          eventId: event.id,
          contractId,
          serviceType,
          consumed: 1,
        },
      );

      // Log if hold was released(记录预留是否被释放)
      if (holdId) {
        this.logger.log(
          `Hold ${holdId} released for session ${sessionId}(会话${sessionId}的预留${holdId}已释放)`,
          {
            eventId: event.id,
            holdId,
          },
        );
      }
    } catch (error) {
      this.logger.error("Error handling session.completed event", error.stack, {
        eventId: event.id,
        eventType: event.eventType,
      });

      // Re-throw to allow retry mechanism to handle
      throw error;
    }
  }
}
