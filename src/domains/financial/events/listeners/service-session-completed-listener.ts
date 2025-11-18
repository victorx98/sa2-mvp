import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IServiceSessionCompletedEvent } from '@shared/events/service-session-completed.event';
import { SERVICE_SESSION_COMPLETED_EVENT } from '@shared/events/service-session-completed.event';

/**
 * Service Session Completed Event Listener[服务会话完成事件监听器]
 * 
 * 负责监听服务会话完成事件，并执行相应的财务处理逻辑
 */
@Injectable()
export class ServiceSessionCompletedListener {
  private readonly logger = new Logger(ServiceSessionCompletedListener.name);

  /**
   * 监听服务会话完成事件[Listen for service session completed events]
   * 
   * @param event The service session completed event data[服务会话完成事件数据]
   */
  @OnEvent(SERVICE_SESSION_COMPLETED_EVENT)
  async handleServiceSessionCompletedEvent(event: IServiceSessionCompletedEvent): Promise<void> {
    try {
      this.logger.debug(
        `Received service session completed event: ${event.id}, sessionId: ${event.payload.sessionId}`,
      );

      const {
        sessionId,
        studentId,
        mentorId,
        refrenceId,
        sessionType,
        durationHours
      } = event.payload || {};

      this.logger.debug(`Completed processing service session event: ${event.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process service session completed event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}