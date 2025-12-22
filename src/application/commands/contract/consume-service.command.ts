import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { CommandBase } from "@application/core/command.base";
import { ConsumeServiceDto } from "@api/dto/request/contract/contract.request.dto";
import * as schema from "@infrastructure/database/schema";
import { HoldStatus } from "@shared/types/contract-enums";
import {
  ContractException,
  ContractNotFoundException,
} from "@domains/contract/common/exceptions/contract.exception";

/**
 * Consume Service Command (Application Layer)
 * [消费服务命令]
 *
 * 职责：
 * 1. 编排服务消费用例
 * 2. 验证学生存在
 * 3. 查询服务权益并加行锁
 * 4. 验证余额充足
 * 5. 按优先级扣除服务权益
 * 6. 创建服务台账记录
 * 7. 释放相关预留（如果有）
 * 8. 管理事务
 */
@Injectable()
export class ConsumeServiceCommand extends CommandBase {
  /**
   * 执行服务消费用例
   * [Execute consume service use case]
   *
   * @param dto 服务消费DTO
   * @param createdBy 创建人ID（来自用户上下文）
   * @returns 执行结果
   */
  async execute(
    dto: ConsumeServiceDto,
    createdBy: string,
  ): Promise<{ success: boolean; message: string }> {
    const {
      studentId,
      serviceType,
      quantity,
      relatedBookingId,
      relatedHoldId,
      bookingSource,
    } = dto;

    // 1. 验证bookingSource（如果提供了relatedBookingId）
    if (relatedBookingId && !bookingSource) {
      throw new ContractException(
        "BOOKING_SOURCE_REQUIRED",
        "bookingSource is required when relatedBookingId is provided",
      );
    }

    this.logger.debug(`Consuming service for student: ${studentId}`);

    await this.db.transaction(async (tx) => {
      // 2. 验证学生存在
      const [student] = await tx
        .select({ id: schema.studentTable.id })
        .from(schema.studentTable)
        .where(eq(schema.studentTable.id, studentId))
        .limit(1);

      if (!student) {
        throw new ContractException("STUDENT_NOT_FOUND");
      }

      // 3. 查询服务权益并加行锁
      const entitlements = await tx
        .select()
        .from(schema.contractServiceEntitlements)
        .where(
          and(
            eq(schema.contractServiceEntitlements.studentId, studentId),
            eq(
              schema.contractServiceEntitlements.serviceType,
              serviceType as string,
            ),
          ),
        )
        .for("update");

      if (entitlements.length === 0) {
        throw new ContractNotFoundException("NO_ENTITLEMENTS_FOUND");
      }

      // 4. 验证余额充足
      const totalAvailable = entitlements.reduce(
        (sum, ent) => sum + ent.availableQuantity,
        0,
      );

      if (totalAvailable < quantity) {
        throw new ContractException("INSUFFICIENT_BALANCE");
      }

      // 5. 按优先级扣除服务权益
      let remainingQuantity = quantity;
      let currentTotalBalance = totalAvailable;
      const ledgerRecords: Array<{
        studentId: string;
        serviceType: string;
        quantity: number;
        type: "consumption";
        source: "booking_completed";
        balanceAfter: number;
        relatedHoldId: string | null;
        relatedBookingId: string | null;
        metadata?: { bookingSource?: string };
        createdBy: string;
      }> = [];

      for (const entitlement of entitlements) {
        if (remainingQuantity <= 0) break;
        if (entitlement.availableQuantity <= 0) continue;

        const deductAmount = Math.min(
          remainingQuantity,
          entitlement.availableQuantity,
        );

        currentTotalBalance -= deductAmount;

        ledgerRecords.push({
          studentId: studentId,
          serviceType: serviceType,
          quantity: -deductAmount,
          type: "consumption",
          source: "booking_completed",
          balanceAfter: currentTotalBalance,
          relatedHoldId: relatedHoldId,
          relatedBookingId: relatedBookingId,
          metadata:
            relatedBookingId && bookingSource ? { bookingSource } : undefined,
          createdBy,
        });

        remainingQuantity -= deductAmount;
      }

      // 6. 创建服务台账记录
      if (ledgerRecords.length > 0) {
        await tx.insert(schema.serviceLedgers).values(ledgerRecords);
      }

      // 7. 释放相关预留（如果有）
      if (relatedHoldId) {
        await tx
          .update(schema.serviceHolds)
          .set({
            status: HoldStatus.RELEASED,
            releaseReason: "completed",
            releasedAt: new Date(),
          })
          .where(eq(schema.serviceHolds.id, relatedHoldId));
      }
    });

    this.logger.debug(`Service consumed successfully for student: ${studentId}`);
    return {
      success: true,
      message: "Service consumed successfully",
    };
  }
}
