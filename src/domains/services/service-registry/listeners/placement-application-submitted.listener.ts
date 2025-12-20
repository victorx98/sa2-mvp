import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent } from "@shared/events/registry";
import { PLACEMENT_APPLICATION_SUBMITTED_EVENT } from "@shared/events/event-constants";
import type { IPlacementApplicationSubmittedEvent } from "@shared/events/placement-application.events";
import { ServiceRegistryService } from "../services/service-registry.service";

@Injectable()
export class PlacementApplicationSubmittedListener {
  private readonly logger = new Logger(PlacementApplicationSubmittedListener.name);

  constructor(private readonly serviceRegistryService: ServiceRegistryService) {}

  @OnEvent(PLACEMENT_APPLICATION_SUBMITTED_EVENT)
  @HandlesEvent(PLACEMENT_APPLICATION_SUBMITTED_EVENT, "ServicesModule")
  async handlePlacementApplicationSubmitted(
    event: IPlacementApplicationSubmittedEvent,
  ): Promise<void> {
    const payload = event.payload;

    try {
      await this.serviceRegistryService.registerService({
        ...payload,
        completed_time:
          payload.completed_time instanceof Date
            ? payload.completed_time
            : new Date(payload.completed_time),
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.debug(`Service reference already registered: id=${payload.id}`);
        return;
      }

      this.logger.error(
        `Failed to register placement application service reference: id=${payload.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

