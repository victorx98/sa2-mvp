import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Get Mentor Price Query (Application Layer)
 * [获取导师价格查询]
 *
 * Retrieves a single mentor price by mentor ID and session type code
 * [根据导师ID和会话类型代码检索单个导师价格]
 */
@Injectable()
export class GetMentorPriceQuery extends QueryBase {
  constructor(private readonly mentorPriceService: MentorPriceService) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with mentorId and sessionTypeCode
   * @returns Mentor price record or null
   */
  async execute(input: {
    mentorId: string;
    sessionTypeCode: string;
  }): Promise<MentorPrice | null> {
    return this.withErrorHandling(async () => {
      return this.mentorPriceService.getMentorPrice(
        input.mentorId,
        input.sessionTypeCode,
      );
    });
  }
}

