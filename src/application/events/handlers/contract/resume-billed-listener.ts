import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent, ResumeBilledEvent } from "@application/events";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { ContractEventListenerBase } from "./event-listener.base";
import { SERVICE_TYPES, BOOKING_SOURCES } from "@domains/contract/common/constants/service-types.constants";

/**
 * Resume Billed Listener for Contract Domain [Contract Domain的简历计费监听器]
 *
 * 负责监听简历计费事件，并记录简历修改服务消耗
 * Responsible for listening to resume billed event and recording resume review service consumption
 *
 * 触发时机：当简历计费确认时
 * Triggered when: When a resume bill is confirmed
 *
 * 业务逻辑：
 * - 服务类型: resume_review (简历修改服务)
 * - 扣除数量: 1 次
 * - 关联预约表: resumes
 */
@Injectable()
export class ResumeBilledListener extends ContractEventListenerBase {
  constructor(
    private readonly serviceLedgerService: ServiceLedgerService,
  ) {
    super(ResumeBilledListener.name);
  }

  /**
   * 监听简历计费事件
   * Listen for resume billed event
   *
   * @param event 简历计费事件数据
   */
  @OnEvent(ResumeBilledEvent.eventType)
  @HandlesEvent(ResumeBilledEvent.eventType, ResumeBilledListener.name)
  async handleResumeBilledEvent(
    event: ResumeBilledEvent,
  ): Promise<void> {
    try {
      const { resumeId, studentId, mentorId, jobTitle } = event.payload || {};

      this.logger.log(
        `Processing resume billed event: ${event.id}, resumeId: ${resumeId}, studentId: ${studentId}, mentorId: ${mentorId}, jobTitle: ${jobTitle}`,
      );

      // Validate required fields using base class method [使用基类方法验证必填字段]
      if (!this.validateEventPayload(event, ["resumeId", "studentId", "mentorId"])) {
        return;
      }

      // 记录简历修改服务消耗 (Record resume review service consumption)
      // 扣除数量: 1 次 (Consumption quantity: 1 time)
      await this.serviceLedgerService.recordConsumption({
        studentId: studentId!,
        serviceType: SERVICE_TYPES.RESUME_REVIEW,
        quantity: 1,
        relatedBookingId: resumeId!,
        bookingSource: BOOKING_SOURCES.RESUMES,
        createdBy: studentId!, // Use studentId as valid UUID for createdBy field [使用studentId作为有效的UUID]
      });

      this.logger.log(
        `Successfully recorded consumption of 1 resume review unit for resume ${resumeId}, student ${studentId}`,
      );
    } catch (error) {
      this.handleEventError(error, "resume billed event");
      // 根据业务需求决定是否需要重新抛出错误
      throw error;
    }
  }
}
