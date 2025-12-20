import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IResumeBillCancelledEvent,
  RESUME_BILL_CANCELLED_EVENT,
} from "@shared/events/resume-bill-cancelled.event";
import { HandlesEvent } from "@shared/events/registry";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { ContractEventListenerBase } from "./event-listener.base";
import { SERVICE_TYPES, BOOKING_SOURCES } from "@domains/contract/common/constants/service-types.constants";

/**
 * Resume Bill Cancelled Listener for Contract Domain [Contract Domain的简历计费取消监听器]
 *
 * 负责监听简历计费取消事件，并退还简历修改服务权益
 * Responsible for listening to resume bill cancelled event and refunding resume review service entitlements
 *
 * 触发时机：当简历计费取消时
 * Triggered when: When a resume bill is cancelled
 *
 * 业务逻辑：
 * - 服务类型: resume_review (简历修改服务)
 * - 退还数量: 1 次
 * - 关联预约表: resumes
 */
@Injectable()
export class ResumeBillCancelledListener extends ContractEventListenerBase {
  constructor(
    private readonly serviceLedgerService: ServiceLedgerService,
  ) {
    super(ResumeBillCancelledListener.name);
  }

  /**
   * 监听简历计费取消事件
   * Listen for resume bill cancelled event
   *
   * @param event 简历计费取消事件数据
   */
  @OnEvent(RESUME_BILL_CANCELLED_EVENT)
  @HandlesEvent(RESUME_BILL_CANCELLED_EVENT, "ContractModule")
  async handleResumeBillCancelledEvent(
    event: IResumeBillCancelledEvent,
  ): Promise<void> {
    try {
      const { resumeId, studentId, mentorId, jobTitle } = event.payload || {};

      this.logger.log(
        `Processing resume bill cancelled event: ${event.id}, resumeId: ${resumeId}, studentId: ${studentId}, mentorId: ${mentorId}, jobTitle: ${jobTitle}`,
      );

      // Validate required fields using base class method [使用基类方法验证必填字段]
      if (!this.validateEventPayload(event, ["resumeId", "studentId", "mentorId"])) {
        return;
      }

      // 记录简历修改服务退款 (Record resume review service refund)
      // 退还数量: 1 次 (Refund quantity: 1 time)
      await this.serviceLedgerService.recordRefund({
        studentId: studentId!,
        serviceType: SERVICE_TYPES.RESUME_REVIEW,
        quantity: 1,
        relatedBookingId: resumeId!,
        bookingSource: BOOKING_SOURCES.RESUMES,
        createdBy: studentId!, // Use studentId as valid UUID for createdBy field [使用studentId作为有效的UUID]
      });

      this.logger.log(
        `Successfully recorded refund of 1 resume review unit for resume ${resumeId}, student ${studentId}`,
      );
    } catch (error) {
      this.handleEventError(error, "resume bill cancelled event");
      // 根据业务需求决定是否需要重新抛出错误
      throw error;
    }
  }
}
