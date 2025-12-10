import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";
import { MentorPriceSearchDto } from "@domains/financial/dto/mentor-price-search.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Get Mentor Prices Query (Application Layer)
 * [获取导师价格列表查询]
 *
 * Retrieves paginated list of mentor prices with filters and sorting
 * [检索带过滤和排序的分页导师价格列表]
 */
@Injectable()
export class GetMentorPricesQuery extends QueryBase {
  constructor(private readonly mentorPriceService: MentorPriceService) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with filter, pagination and sort
   * @returns Paginated mentor prices
   */
  async execute(input: {
    filter: MentorPriceSearchDto;
    pagination?: { page: number; pageSize: number };
    sort?: { field: string; order: "asc" | "desc" };
  }): Promise<{
    data: MentorPrice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.withErrorHandling(async () => {
      const pagination = input.pagination || {
        page: input.filter.page || 1,
        pageSize: input.filter.pageSize || 10,
      };

      const sort = input.sort || {
        field: input.filter.sortField || "updatedAt",
        order: (input.filter.sortOrder as "asc" | "desc") || "desc",
      };

      return this.mentorPriceService.searchMentorPrices(
        {
          mentorId: input.filter.mentorId,
          sessionTypeCode: input.filter.sessionTypeCode,
          status: input.filter.status,
          packageCode: input.filter.packageCode,
        },
        pagination,
        sort,
      );
    });
  }
}

