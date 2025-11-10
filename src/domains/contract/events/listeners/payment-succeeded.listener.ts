import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { ContractService } from "../../services/contract.service";
import { IEventPublisher } from "../../services/event-publisher.service";

/**
 * Payment Succeeded Event Listener(支付成功事件监听器)
 *
 * Listens for payment.succeeded events and automatically activates contracts(监听payment.succeeded事件并在收到初始付款时自动激活合同)
 * when initial payment is received.
 *
 * Outbox Pattern: Events are published by EventPublisherService and this(出站模式：事件由EventPublisherService发布，此监听器从消息总线消费)
 * listener consumes them from the message bus.
 */
@Injectable()
export class PaymentSucceededListener implements OnModuleInit {
  private readonly logger = new Logger(PaymentSucceededListener.name);

  constructor(
    private readonly contractService: ContractService,
    @Inject('EVENT_PUBLISHER') private readonly eventPublisher: IEventPublisher,
  ) {}

  onModuleInit() {
    // Subscribe to payment.succeeded events(订阅payment.succeeded事件)
    this.eventPublisher.subscribe("payment.succeeded", (event) =>
      this.handlePaymentSucceeded(event),
    );

    this.logger.log("PaymentSucceededListener initialized");
  }

  /**
   * Handle payment.succeeded event(处理payment.succeeded事件)
   * @param event The payment event(支付事件)
   */
  private async handlePaymentSucceeded(event: any): Promise<void> {
    try {
      const { payload } = event;

      // Validate required fields(验证必填字段)
      if (!payload?.contractId) {
        this.logger.warn("Invalid payment event: missing contractId(无效的支付事件：缺少contractId)", {
          eventId: event.id,
        });
        return;
      }

      const contractId = payload.contractId;
      const paymentAmount = payload.amount;
      const paymentCurrency = payload.currency;

      this.logger.log(`Processing payment for contract: ${contractId}(处理合同${contractId}的付款)`, {
        eventId: event.id,
        paymentAmount,
        paymentCurrency,
      });

      // Find the contract(查找合同)
      const contract = await this.contractService.findOne({
        contractId,
      });

      if (!contract) {
        this.logger.error(`Contract not found: ${contractId}(合同未找到：${contractId})`, {
          eventId: event.id,
        });
        return;
      }

      // Only activate if contract status is signed(仅在合同状态为已签署时激活)
      if (contract.status !== "signed") {
        this.logger.warn(
          `Cannot activate contract ${contractId}: status is ${contract.status}(无法激活合同${contractId}：状态为${contract.status})`,
          {
            eventId: event.id,
            currentStatus: contract.status,
          },
        );
        return;
      }

      // Activate the contract(激活合同)
      this.logger.log(`Activating contract ${contractId}(正在激活合同${contractId})`, {
        eventId: event.id,
      });

      await this.contractService.activate(contractId);

      this.logger.log(`Contract ${contractId} activated successfully(合同${contractId}成功激活)`, {
        eventId: event.id,
        contractId,
      });
    } catch (error) {
      this.logger.error(
        "Error handling payment.succeeded event(处理payment.succeeded事件时出错)",
        error.stack,
        {
          eventId: event.id,
          eventType: event.eventType,
        },
      );

      // Re-throw to allow retry mechanism to handle(重新抛出以允许重试机制处理)
      throw error;
    }
  }
}
