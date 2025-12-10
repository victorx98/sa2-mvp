import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { MentorPaymentInfoService } from "@domains/financial/services/mentor-payment-info.service";
import type { IMentorPaymentInfoResponse } from "@domains/financial/dto/settlement";

/**
 * Get Mentor Payment Info Query (Application Layer)
 * [获取导师支付信息查询]
 *
 * Retrieves payment information for a specific mentor
 * [检索特定导师的支付信息]
 */
@Injectable()
export class GetMentorPaymentInfoQuery extends QueryBase {
  constructor(
    private readonly mentorPaymentInfoService: MentorPaymentInfoService,
  ) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with mentorId
   * @returns Mentor payment info response or null
   */
  async execute(input: {
    mentorId: string;
  }): Promise<IMentorPaymentInfoResponse | null> {
    return this.withErrorHandling(async () => {
      return this.mentorPaymentInfoService.getMentorPaymentInfo(
        input.mentorId,
      );
    });
  }
}

