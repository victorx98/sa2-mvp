import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
// 引用领域服务接口，而非具体实现（如果可能）
import { RegularMentoringService } from '@domains/services/sessions/regular-mentoring/services/regular-mentoring.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

@Injectable()
export class RegularMentoringMeetingCompletedHandler {
  private readonly logger = new Logger(RegularMentoringMeetingCompletedHandler.name);

  constructor(
    private readonly regularMentoringService: RegularMentoringService,
  ) {}

  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handle(payload: MeetingLifecycleCompletedPayload): Promise<void> {
    this.logger.log(`[Application] Handling meeting completion for: ${payload.meetingId}`);

    // 应用层负责协调：先查，再改
    const session = await this.regularMentoringService.findByMeetingId(payload.meetingId);

    if (session) {
        // 调用 Domain Service 的方法来变更状态
        // 注意：这里最好也在一个事务中，虽然当前业务逻辑可能只有一步
        await this.regularMentoringService.completeSession(session.id, payload);
    }
  }
}
