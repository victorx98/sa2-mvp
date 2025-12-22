import { Injectable } from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import { CommandBase } from "@application/core/command.base";
import { AddAmendmentLedgerDto } from "@api/dto/request/contract/contract.request.dto";
import * as schema from "@infrastructure/database/schema";
import type { ContractServiceEntitlement } from "@infrastructure/database/schema";
import {
  ContractException,
  ContractNotFoundException,
} from "@domains/contract/common/exceptions/contract.exception";

/**
 * Add Amendment Ledger Command (Application Layer)
 * [添加权益变更台账命令]
 *
 * 职责：
 * 1. 编排权益变更台账添加用例
 * 2. 验证bookingSource（如果提供了relatedBookingId）
 * 3. 查询合同
 * 4. 插入权益变更台账记录
 * 5. 查询最后一条台账记录计算当前余额
 * 6. 插入新的台账记录
 * 7. 返回更新后的服务权益
 * 8. 管理事务
 */
@Injectable()
export class AddAmendmentLedgerCommand extends CommandBase {
  /**
   * 执行添加权益变更台账用例
   * [Execute add amendment ledger use case]
   *
   * @param dto 权益变更台账DTO
   * @returns 更新后的服务权益
   */
  async execute(
    dto: AddAmendmentLedgerDto,
  ): Promise<ContractServiceEntitlement> {
    const {
      studentId,
      contractId,
      serviceType,
      ledgerType,
      quantityChanged,
      reason,
      description,
      attachments,
      relatedBookingId,
      bookingSource,
      createdBy,
    } = dto;

    // 1. 验证bookingSource（如果提供了relatedBookingId）
    if (relatedBookingId && !bookingSource) {
      throw new ContractException(
        "BOOKING_SOURCE_REQUIRED",
        "bookingSource is required when relatedBookingId is provided",
      );
    }

    this.logger.debug(
      `Adding amendment ledger for student: ${studentId}`,
    );

    const entitlement = await this.db.transaction(async (tx) => {
      // 2. 查询合同
      const contract = await tx.query.contracts.findFirst({
        where: eq(schema.contracts.id, contractId),
      });

      if (!contract) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      // 3. 插入权益变更台账记录
      const serviceTypeCode =
        typeof serviceType === "string" ? serviceType : (serviceType as any).code;

      await tx
        .insert(schema.contractAmendmentLedgers)
        .values({
          studentId,
          serviceType: serviceTypeCode,
          ledgerType,
          quantityChanged,
          reason,
          description:
            description ||
            `Add ${serviceTypeCode} entitlement for contract ${contractId}`,
          attachments,
          createdBy,
          snapshot: {
            contractId,
            contractNumber: contract.contractNumber,
          },
        })
        .returning();

      // 4. 查询最后一条台账记录计算当前余额
      const lastLedger = await tx.query.serviceLedgers.findFirst({
        where: and(
          eq(schema.serviceLedgers.studentId, studentId),
          eq(schema.serviceLedgers.serviceType, serviceTypeCode),
        ),
        orderBy: [desc(schema.serviceLedgers.createdAt)],
      });

      const currentBalance = lastLedger?.balanceAfter || 0;
      const newBalance = currentBalance + quantityChanged;

      // 5. 插入新的台账记录
      await tx.insert(schema.serviceLedgers).values({
        studentId,
        serviceType: serviceTypeCode,
        quantity: quantityChanged,
        type: "adjustment",
        source: "manual_adjustment",
        balanceAfter: newBalance,
        relatedBookingId: relatedBookingId || undefined,
        reason: `Added ${serviceTypeCode} entitlement: ${reason || "No reason provided"}`,
        createdBy,
        metadata:
          relatedBookingId && bookingSource ? { bookingSource } : undefined,
      });

      // 6. 查询并返回更新后的服务权益
      const updatedEntitlement = await tx.query.contractServiceEntitlements.findFirst({
        where: and(
          eq(schema.contractServiceEntitlements.studentId, studentId),
          eq(schema.contractServiceEntitlements.serviceType, serviceTypeCode),
        ),
      });

      if (!updatedEntitlement) {
        throw new ContractException(
          "ENTITLEMENT_UPDATE_FAILED",
          "Failed to update entitlement after amendment ledger insertion. Trigger may have failed.",
        );
      }

      return updatedEntitlement;
    });

    this.logger.debug(
      `Amendment ledger added successfully for student: ${studentId}`,
    );
    return entitlement;
  }
}
