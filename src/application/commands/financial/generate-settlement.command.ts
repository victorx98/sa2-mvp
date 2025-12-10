import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { SettlementService } from "@domains/financial/services/settlement.service";
import type { ICreateSettlementRequest } from "@domains/financial/dto/settlement";
import type { ISettlementDetailResponse } from "@domains/financial/dto/settlement";

/**
 * Generate Settlement Command (Application Layer)
 * [生成结算命令]
 *
 * Orchestrates settlement generation use case
 * [编排结算生成用例]
 */
@Injectable()
export class GenerateSettlementCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly settlementService: SettlementService,
  ) {
    super(db);
  }

  /**
   * Execute generate settlement use case
   * [执行生成结算用例]
   *
   * @param input - Generate settlement input
   * @returns Settlement detail response
   */
  async execute(input: {
    request: ICreateSettlementRequest;
    createdBy: string;
  }): Promise<ISettlementDetailResponse> {
    try {
      this.logger.debug(
        `Generating settlement for mentor: ${input.request.mentorId}, month: ${input.request.settlementMonth}`,
      );
      const settlement = await this.settlementService.generateSettlement(
        input.request,
        input.createdBy,
      );
      this.logger.debug(`Settlement generated successfully: ${settlement.id}`);
      return settlement;
    } catch (error) {
      this.logger.error(
        `Failed to generate settlement: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

