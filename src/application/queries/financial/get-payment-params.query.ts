import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { MentorPaymentParamService } from "@domains/financial/services/mentor-payment-param.service";

/**
 * Get Payment Params Query (Application Layer)
 * [获取支付参数查询]
 *
 * Retrieves payment parameters for a specific currency and month
 * [检索特定币种和月份的支付参数]
 */
@Injectable()
export class GetPaymentParamsQuery extends QueryBase {
  constructor(
    private readonly mentorPaymentParamService: MentorPaymentParamService,
  ) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with currency and settlementMonth
   * @returns Payment parameters or null
   */
  async execute(input: {
    currency: string;
    settlementMonth: string;
  }): Promise<{
    currency: string;
    settlementMonth: string;
    defaultExchangeRate: number;
    defaultDeductionRate: number;
  } | null> {
    return this.withErrorHandling(async () => {
      return this.mentorPaymentParamService.getDefaultParams(
        input.currency,
        input.settlementMonth,
      );
    });
  }
}

