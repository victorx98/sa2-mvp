/**
 * Get Service Consumption Use Case
 * 服务消费记录查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IContractQueryRepository, CONTRACT_QUERY_REPOSITORY } from '../interfaces/contract-query.repository.interface';
import { ServiceConsumptionReadModel } from '../models/contract-read.model';
import { GetServiceConsumptionDto } from '../dto/contract-query.dto';

@Injectable()
export class GetServiceConsumptionUseCase {
  constructor(
    @Inject(CONTRACT_QUERY_REPOSITORY)
    private readonly contractQueryRepository: IContractQueryRepository,
  ) {}

  async execute(dto: GetServiceConsumptionDto): Promise<IPaginatedResult<ServiceConsumptionReadModel>> {
    return this.contractQueryRepository.getServiceTypeConsumptionRecords(dto);
  }
}

