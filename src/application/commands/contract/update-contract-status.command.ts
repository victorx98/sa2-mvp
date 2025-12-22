import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { CommandBase } from "@application/core/command.base";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { UpdateContractStatusDto } from "@api/dto/request/contract/contract.request.dto";
import type { Contract } from "@infrastructure/database/schema";
import * as schema from "@infrastructure/database/schema";
import { ContractStatus } from "@shared/types/contract-enums";
import {
  ContractException,
  ContractNotFoundException,
} from "@domains/contract/common/exceptions/contract.exception";

/**
 * Update Contract Status Command
 * [更新合同状态命令]
 *
 * Used for updating contract status through unified endpoint
 * [用于通过统一端点更新合同状态]
 */
@Injectable()
export class UpdateContractStatusCommand extends CommandBase {
  /**
   * Execute command [执行命令]
   *
   * @param id Contract ID [合同ID]
   * @param dto Status update DTO [状态更新DTO]
   * @param userId Current user ID (optional, used for sign operation) [当前用户ID（可选，用于签署操作）]
   * @returns Updated contract [更新后的合同]
   */
  async execute(id: string, dto: UpdateContractStatusDto, userId?: string): Promise<Contract> {
    const { status: targetStatus, reason, signedBy } = dto;
    const changedBy = signedBy || userId || null;

    this.logger.debug(`Updating contract status: ${id} -> ${targetStatus}`);

    return this.db.transaction(async (tx) => {
      // 1. 查找合同
      const contract = await tx.query.contracts.findFirst({
        where: eq(schema.contracts.id, id),
      });

      if (!contract) {
        throw new ContractNotFoundException("CONTRACT_NOT_FOUND");
      }

      const previousStatus = contract.status;

      // 2. 应用状态变更
      switch (targetStatus) {
        case ContractStatus.DRAFT: {
          if (previousStatus !== ContractStatus.SIGNED) {
            throw new ContractException(
              "CONTRACT_NOT_SIGNED",
              "Only signed contracts can be reverted to draft",
            );
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.DRAFT,
            changedBy,
            reason,
          );
        }

        case ContractStatus.SIGNED: {
          if (previousStatus !== ContractStatus.DRAFT) {
            throw new ContractException("CONTRACT_NOT_DRAFT");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.SIGNED,
            changedBy,
          );
        }

        case ContractStatus.ACTIVE: {
          if (previousStatus === ContractStatus.ACTIVE) {
            throw new ContractException("CONTRACT_ALREADY_ACTIVE");
          }
          if (previousStatus === ContractStatus.SUSPENDED) {
            return this.applyStatusChange(
              tx,
              id,
              previousStatus,
              ContractStatus.ACTIVE,
              changedBy,
            );
          }
          if (previousStatus === ContractStatus.SIGNED) {
            return this.applyStatusChange(
              tx,
              id,
              previousStatus,
              ContractStatus.ACTIVE,
              changedBy,
            );
          }
          throw new ContractException(
            "INVALID_CONTRACT_STATUS",
            `Cannot activate contract from status: ${previousStatus}`,
          );
        }

        case ContractStatus.SUSPENDED: {
          if (previousStatus !== ContractStatus.ACTIVE) {
            throw new ContractException("CONTRACT_NOT_ACTIVE");
          }
          if (!reason || reason.trim().length === 0) {
            throw new ContractException("SUSPENSION_REQUIRES_REASON");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.SUSPENDED,
            changedBy,
            reason,
          );
        }

        case ContractStatus.COMPLETED: {
          if (previousStatus !== ContractStatus.ACTIVE) {
            throw new ContractException("CONTRACT_NOT_ACTIVE");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.COMPLETED,
            changedBy,
          );
        }

        case ContractStatus.TERMINATED: {
          if (
            previousStatus !== ContractStatus.ACTIVE &&
            previousStatus !== ContractStatus.SUSPENDED
          ) {
            throw new ContractException("CONTRACT_NOT_TERMINATABLE");
          }
          if (!reason || reason.trim().length === 0) {
            throw new ContractException("TERMINATION_REQUIRES_REASON");
          }
          return this.applyStatusChange(
            tx,
            id,
            previousStatus,
            ContractStatus.TERMINATED,
            changedBy,
            reason,
          );
        }

        default: {
          throw new ContractException(
            "INVALID_STATUS",
            `Invalid target status: ${targetStatus}`,
          );
        }
      }
    });
  }

  /**
   * 应用状态变更到合同
   * [Apply status change to contract]
   */
  private async applyStatusChange(
    tx: DrizzleDatabase,
    contractId: string,
    fromStatus: ContractStatus,
    toStatus: ContractStatus,
    changedBy: string | null,
    reason?: string | null,
  ): Promise<Contract> {
    const [updatedContract] = await tx
      .update(schema.contracts)
      .set({
        status: toStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.contracts.id, contractId))
      .returning();

    await tx.insert(schema.contractStatusHistory).values({
      contractId,
      fromStatus,
      toStatus,
      changedAt: new Date(),
      changedBy,
      reason: reason || null,
      metadata: {},
    });

    return updatedContract;
  }
}
