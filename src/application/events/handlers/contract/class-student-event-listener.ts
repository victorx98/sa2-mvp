import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ClassStudentAddedEvent,
  ClassStudentRemovedEvent,
  HandlesEvent,
} from "@application/events";
import { ServiceLedgerService } from "@domains/contract/services/service-ledger.service";
import { ContractEventListenerBase } from "./event-listener.base";
import { SERVICE_TYPES, BOOKING_SOURCES } from "@domains/contract/common/constants/service-types.constants";

/**
 * Class Student Event Listener for Contract Domain [Contract Domain的班级学生事件监听器]
 *
 * 负责监听学生加入/离开班级事件，并处理班级权益的扣除/退还
 * Responsible for listening to student add/remove class events and handling class entitlement deduction/refund
 *
 * 触发时机：
 * - 学生加入班级时 → 扣除班级权益
 * - 学生离开班级时 → 退还班级权益
 *
 * Triggered when:
 * - Student joins class → Deduct class entitlement
 * - Student leaves class → Refund class entitlement
 *
 * 业务规则：
 * - 班课权益记录方式：记录学生可以加入的班级数量（不是课节或课次）
 * - 扣除数量：deductionQuantity（默认值为1）
 * - 退还数量：refundQuantity（默认值为1）
 * - 服务类型：class
 * - 单位类型：times
 */
@Injectable()
export class ClassStudentEventListener extends ContractEventListenerBase {
  constructor(
    private readonly serviceLedgerService: ServiceLedgerService,
  ) {
    super(ClassStudentEventListener.name);
  }

  /**
   * 监听学生加入班级事件
   * Listen for class student added event
   *
   * @param event 学生加入班级事件数据
   */
  @OnEvent(ClassStudentAddedEvent.eventType)
  @HandlesEvent(ClassStudentAddedEvent.eventType, ClassStudentEventListener.name)
  async handleClassStudentAddedEvent(
    event: ClassStudentAddedEvent,
  ): Promise<void> {
    try {
      const { classId, studentId, deductionQuantity = 1 } = event.payload || {};

      this.logger.log(
        `Processing class student added event: ${event.id}, classId: ${classId}, studentId: ${studentId}, deductionQuantity: ${deductionQuantity}`,
      );

      // Validate required fields using base class method [使用基类方法验证必填字段]
      if (!this.validateEventPayload(event, ["classId", "studentId"])) {
        return;
      }

      // Validate deduction quantity is positive [验证扣除数量为正数]
      if (
        !this.validatePositiveQuantity(deductionQuantity, "deductionQuantity")
      ) {
        return;
      }

      // 记录班级权益扣除 (Record class entitlement deduction)
      // 扣除数量: deductionQuantity (默认值为1) (Deduction quantity: deductionQuantity (default: 1))
      await this.serviceLedgerService.recordConsumption({
        studentId: studentId!,
        serviceType: SERVICE_TYPES.CLASS,
        quantity: deductionQuantity!,
        relatedBookingId: classId!,
        bookingSource: BOOKING_SOURCES.CLASSES,
        createdBy: studentId!, // Use studentId as valid UUID for createdBy field [使用studentId作为有效的UUID]
      });

      this.logger.log(
        `Successfully recorded deduction of ${deductionQuantity} class entitlements for class ${classId}, student ${studentId}`,
      );
    } catch (error) {
      this.handleEventError(error, "class student added event");
      // 根据业务需求决定是否需要重新抛出错误
      throw error;
    }
  }

  /**
   * 监听学生离开班级事件
   * Listen for class student removed event
   *
   * @param event 学生离开班级事件数据
   */
  @OnEvent(ClassStudentRemovedEvent.eventType)
  @HandlesEvent(ClassStudentRemovedEvent.eventType, ClassStudentEventListener.name)
  async handleClassStudentRemovedEvent(
    event: ClassStudentRemovedEvent,
  ): Promise<void> {
    try {
      const { classId, studentId, refundQuantity = 1 } = event.payload || {};

      this.logger.log(
        `Processing class student removed event: ${event.id}, classId: ${classId}, studentId: ${studentId}, refundQuantity: ${refundQuantity}`,
      );

      // Validate required fields using base class method [使用基类方法验证必填字段]
      if (!this.validateEventPayload(event, ["classId", "studentId"])) {
        return;
      }

      // Validate refund quantity is positive [验证退还数量为正数]
      if (!this.validatePositiveQuantity(refundQuantity, "refundQuantity")) {
        return;
      }

      // 记录班级权益退还 (Record class entitlement refund)
      // 退还数量: refundQuantity (默认值为1) (Refund quantity: refundQuantity (default: 1))
      await this.serviceLedgerService.recordRefund({
        studentId: studentId!,
        serviceType: SERVICE_TYPES.CLASS,
        quantity: refundQuantity!,
        relatedBookingId: classId!,
        bookingSource: BOOKING_SOURCES.CLASSES,
        createdBy: studentId!, // Use studentId as valid UUID for createdBy field [使用studentId作为有效的UUID]
      });

      this.logger.log(
        `Successfully recorded refund of ${refundQuantity} class entitlements for class ${classId}, student ${studentId}`,
      );
    } catch (error) {
      this.handleEventError(error, "class student removed event");
      // 根据业务需求决定是否需要重新抛出错误
      throw error;
    }
  }
}
