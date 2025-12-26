/**
 * List Mentor Prices Use Case
 * 导师价格列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMentorPriceQueryRepository, MENTOR_PRICE_QUERY_REPOSITORY } from '../interfaces/mentor-price-query.repository.interface';
import { MentorPriceReadModel } from '../models/mentor-price-read.model';
import { ListMentorPricesDto } from '../dto/list-mentor-prices.dto';

@Injectable()
export class ListMentorPricesUseCase {
  constructor(
    @Inject(MENTOR_PRICE_QUERY_REPOSITORY)
    private readonly mentorPriceQueryRepository: IMentorPriceQueryRepository,
  ) {}

  async execute(dto: ListMentorPricesDto): Promise<IPaginatedResult<MentorPriceReadModel>> {
    return this.mentorPriceQueryRepository.listMentorPrices(dto);
  }
}

