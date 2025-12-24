import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent, SettlementConfirmedEvent } from "@application/events";
import { MentorPaymentParamService } from "@domains/financial/services/mentor-payment-param.service";
import { Inject } from "@nestjs/common";

/**
 * Settlement Confirmed Event Listener (结算确认事件监听器)
 *
 * Listens for settlement confirmed events and handles post-settlement processing.
 * Updates or creates payment parameter records for the settlement month.
 *
 * 监听结算确认事件并处理结算后的逻辑。
 * 为结算月份更新或创建支付参数记录。
 */
@Injectable()
export class SettlementConfirmedListener {
  private readonly logger = new Logger(SettlementConfirmedListener.name);

  constructor(
    @Inject("IMentorPaymentParamService")
    private readonly paymentParamService: MentorPaymentParamService,
  ) {}

  onModuleInit() {
    this.logger.log("SettlementConfirmedListener initialized");
  }

  /**
   * Handle settlement confirmed event (处理结算确认事件)
   *
   * This method is triggered when a settlement confirmed event is published.
   * It extracts the currency and settlement parameters from the event and
   * updates/creates the payment parameter record for the settlement month.
   *
   * 当结算确认事件发布时触发此方法。
   * 从事件中提取币种和结算参数，并为结算月份更新/创建支付参数记录。
   *
   * Note: Settlement detail associations are already created in SettlementService
   * through the settlement_details table, so no additional processing is needed here.
   *
   * 注意：结算明细关联已在 SettlementService 中通过 settlement_details 表创建，
   * 因此这里不需要额外处理。
   *
   * @param event - Settlement confirmed event (结算确认事件)
   */
  @OnEvent(SettlementConfirmedEvent.eventType, { async: true })
  @HandlesEvent(SettlementConfirmedEvent.eventType, SettlementConfirmedListener.name)
  public async handleSettlementConfirmed(
    event: SettlementConfirmedEvent,
  ): Promise<void> {
    try {
      const { payload } = event;

      this.logger.log(
        `Received settlement confirmed event: ${payload.settlementId}, mentor: ${payload.mentorId}`,
      );

      // 1. Extract settlement parameters (提取结算参数)
      const {
        settlementMonth,
        targetCurrency,
        exchangeRate,
        deductionRate,
        createdBy,
      } = payload;

      // 2. Update or create payment parameters (更新或创建支付参数)
      // Modified parameters will be used for subsequent settlement batches
      // 修改后的参数将用于后续结算批次
      await this.paymentParamService.updateOrCreateDefaultParams(
        targetCurrency, // Use target currency from settlement
        settlementMonth,
        {
          defaultExchangeRate: exchangeRate,
          defaultDeductionRate: deductionRate,
        },
        createdBy,
      );

      this.logger.log(
        `Updated payment parameters for ${targetCurrency} ${settlementMonth}: ` +
          `exchangeRate=${exchangeRate}, deductionRate=${deductionRate}`,
      );

      // 3. Note: Payment parameter updates do NOT affect already created settlement records
      // because settlement records use append-only mode (注意：支付参数更新不影响已创建的
      // 结算记录，因为结算记录使用append-only模式)

      this.logger.log(
        `Successfully processed settlement confirmed event: ${payload.settlementId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing settlement confirmed event: ${event?.payload?.settlementId}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Note: Event processing errors are logged but not re-thrown
      // to prevent event bus from stopping (注意：事件处理错误被记录但不重新抛出，
      // 以防止事件总线停止)
    }
  }
}
