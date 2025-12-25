/**
 * Mentor Price Query Repository Interface
 * 导师价格查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { MentorPriceReadModel } from '../models/mentor-price-read.model';
import { ListMentorPricesDto } from '../dto/list-mentor-prices.dto';

/**
 * DI Token for Mentor Price Query Repository
 */
export const MENTOR_PRICE_QUERY_REPOSITORY = Symbol('MENTOR_PRICE_QUERY_REPOSITORY');

/**
 * Mentor Price Query Repository Interface
 */
export interface IMentorPriceQueryRepository {
  /**
   * List mentor prices with filters, pagination and sorting
   * 
   * @param dto - Query input
   * @returns Paginated mentor price results
   */
  listMentorPrices(dto: ListMentorPricesDto): Promise<IPaginatedResult<MentorPriceReadModel>>;
}

