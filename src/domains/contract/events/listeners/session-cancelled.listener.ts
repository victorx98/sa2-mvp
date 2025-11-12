import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { IEventPublisher } from "../../services/event-publisher.service";
import { ServiceHoldService } from "../../services/service-hold.service";
import type { ISessionCancelledEvent } from "../../common/types/event.types";

/**
 * Session Cancelled Event Listener
 *
 * Listens for session.cancelled events and releases service holds
 * without consuming service entitlements.
 *
 * This ensures that when a student cancels a booked session before
 * it starts, the pre-allocated service entitlements are released
 * back to the available balance.
 */
@Injectable()
export class SessionCancelledListener implements OnModuleInit {
  private readonly logger = new Logger(SessionCancelledListener.name);

  constructor(
    private readonly holdService: ServiceHoldService,
    @Inject("EVENT_PUBLISHER") private readonly eventPublisher: IEventPublisher,
  ) {}

  onModuleInit() {
    // Subscribe to session.cancelled events
    this.eventPublisher.subscribe("session.cancelled", (event: any) =>
      this.handleSessionCancelled(event),
    );

    this.logger.log("SessionCancelledListener initialized");
  }

  /**
   * Handle session.cancelled event
   * @param event The session cancelled event
   */
  private async handleSessionCancelled(
    event: ISessionCancelledEvent,
  ): Promise<void> {
    try {
      const { payload } = event;

      // Validate required fields
      if (!payload?.sessionId) {
        this.logger.warn("Invalid session event: missing sessionId", {
          eventId: event.id,
        });
        return;
      }

      if (!payload?.holdId) {
        this.logger.warn(
          "Session cancelled without associated hold. No action needed.",
          {
            eventId: event.id,
            sessionId: payload.sessionId,
          },
        );
        return;
      }

      const { sessionId, holdId } = payload;

      this.logger.log(`Processing cancelled session: ${sessionId}`, {
        eventId: event.id,
        sessionId,
        holdId,
      });

      // Cancel the hold (releases service entitlement without consumption)
      await this.holdService.cancelHold(holdId, "cancelled");

      this.logger.log(
        `Hold ${holdId} cancelled for session ${sessionId} (entitlement released)`,
        {
          eventId: event.id,
          sessionId,
          holdId,
        },
      );
    } catch (error) {
      this.logger.error("Error handling session.cancelled event", error.stack, {
        eventId: event.id,
        eventType: event.eventType,
      });

      // Re-throw to allow retry mechanism to handle
      throw error;
    }
  }
}
